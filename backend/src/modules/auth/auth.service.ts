import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuditAction, UserRole, WalletOwnerType } from '@prisma/client';
import { randomUUID, randomBytes, createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AppConfigService } from '../../config/app-config.service';
import { PasswordHasher } from './password-hasher.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await this.passwordHasher.hash(dto.password);

    // User creation + wallet provisioning happen in one transaction: a user
    // must never exist without a corresponding wallet account, and vice versa.
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: dto.email,
          phone: dto.phone,
          passwordHash,
          fullName: dto.fullName,
          role: UserRole.CUSTOMER,
        },
      });
      await tx.walletAccount.create({
        data: {
          ownerId: created.id,
          ownerType: WalletOwnerType.USER,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: created.id,
          action: AuditAction.CREATE,
          entityType: 'User',
          entityId: created.id,
        },
      });
      return created;
    });

    this.logger.log(`New user registered: ${user.id}`);
    return this.issueTokens(user.id, user.role);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      await this.recordFailedLogin(dto.email);
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordOk = await this.passwordHasher.verify(user.passwordHash, dto.password);
    if (!passwordOk) {
      await this.recordFailedLogin(dto.email, user.id);
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.prisma.auditLog.create({
      data: { actorId: user.id, action: AuditAction.LOGIN, entityType: 'User', entityId: user.id },
    });

    return this.issueTokens(user.id, user.role);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: stored.userId } });

    // Rotate: revoke the used token and issue a brand new pair. A refresh
    // token that gets used twice (theft/replay) will fail on its second use
    // because it was already revoked on its first — this is the detection
    // mechanism described in docs/security/security-model.md §1.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(user.id, user.role);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(userId: string, role: UserRole): Promise<AuthTokens> {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, role },
      { secret: this.config.jwtAccessSecret, expiresIn: this.config.jwtAccessExpiresIn },
    );

    const refreshTokenPlain = randomUUID() + randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(refreshTokenPlain);
    const expiresAt = new Date(
      Date.now() + this.config.jwtRefreshExpiresInDays * 24 * 60 * 60 * 1000,
    );

    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });

    return { accessToken, refreshToken: refreshTokenPlain };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async recordFailedLogin(email: string, userId?: string): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        action: AuditAction.LOGIN_FAILED,
        entityType: 'User',
        metadata: { email },
      },
    });
  }
}
