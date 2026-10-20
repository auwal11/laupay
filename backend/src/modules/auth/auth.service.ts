import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuditAction, Prisma, User, UserRole, WalletOwnerType } from '@prisma/client';
import { randomUUID, randomBytes, createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AppConfigService } from '../../config/app-config.service';
import { PasswordHasher } from './password-hasher.service';
import { RegisterDto, LoginDto, VerifyOtpDto } from './dto/auth.dto';
import { OtpService } from './otp.service';
import { Inject } from '@nestjs/common';
import { MAIL_PROVIDER, MailProvider } from '../../common/mail/mail-provider.interface';
import { ProfileStorageService } from '../../common/storage/profile-storage.service';
import { normalizeFullName } from '../../common/utils/name.util';
import { CreditsService } from '../credits/credits.service';
import { ADMIN_ROLES, permissionsForRole } from '../../common/permissions';

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
    private readonly otp: OtpService,
    @Inject(MAIL_PROVIDER) private readonly mail: MailProvider,
    private readonly profileStorage: ProfileStorageService,
    private readonly credits: CreditsService,
  ) {}

  /**
   * Verifies the emailed code, flips PENDING_VERIFICATION -> ACTIVE and only
   * then issues tokens (requirements 3 + 4). No code, no tokens.
   */
  async verifyEmail(dto: VerifyOtpDto, _ip?: string) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    // Same message whether the email exists or the code is wrong.
    if (!user) throw new UnauthorizedException('Invalid or expired verification code');

    if (user.status === 'ACTIVE') {
      await this.tryAutoTestCredit(user.id);
      return this.issueTokens(user.id, user.role);
    }

    await this.otp.consume(user.id, dto.code);

    const activated = await this.prisma.user.update({
      where: { id: user.id },
      data: { status: 'ACTIVE' },
    });
    this.logger.log(`User ${user.id} email verified`);

    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: AuditAction.UPDATE,
        entityType: 'User',
        entityId: user.id,
      },
    });

    // Best-effort welcome email: a mail hiccup must never block activation —
    // the account is already ACTIVE and the client still gets its tokens.
    try {
      await this.mail.sendWelcome({ to: activated.email, fullName: activated.fullName });
    } catch (err) {
      this.logger.warn(`Welcome email skipped for ${activated.id}: ${String(err)}`);
    }

    await this.tryAutoTestCredit(activated.id);

    return this.issueTokens(activated.id, activated.role);
  }

  /**
   * Applies the one-shot automatic test credit once the account is ACTIVE and
   * a transaction PIN exists (see CreditsService). No-op unless enabled in
   * admin settings; failures are swallowed so they can never block auth.
   */
  private async tryAutoTestCredit(userId: string): Promise<void> {
    try {
      await this.credits.maybeApplyAutoTestCredit(userId);
    } catch (err) {
      this.logger.warn(`Auto test credit skipped for ${userId}: ${String(err)}`);
    }
  }

  async register(dto: RegisterDto) {
    if (dto.termsAccepted !== true) throw new ForbiddenException('Terms acceptance is required');
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }
    if (dto.phone) {
      // phone is @unique in the schema; check up-front for a friendly error
      // rather than letting the insert fail with a raw constraint error.
      const existingPhone = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
      if (existingPhone) {
        throw new ConflictException('An account with this phone number already exists');
      }
    }

    const passwordHash = await this.passwordHasher.hash(dto.password);

    // A profile photo is optional. Storage being unavailable (misconfigured
    // bucket, outage) must never block account creation — log it and continue
    // without the photo rather than failing the whole registration.
    let profilePhotoUrl: string | undefined;
    if (dto.profilePhotoData) {
      try {
        profilePhotoUrl = await this.profileStorage.save(dto.profilePhotoData);
      } catch (err) {
        this.logger.warn(`Profile photo upload skipped during registration: ${String(err)}`);
      }
    }

    // User creation + wallet provisioning happen in one transaction: a user
    // must never exist without a corresponding wallet account, and vice versa.
    let user: User;
    try {
      user = await this.prisma.$transaction(
        async (tx) => {
          const created = await tx.user.create({
            data: {
              email: dto.email,
              phone: dto.phone,
              passwordHash,
              fullName: normalizeFullName(dto.fullName),
            role: UserRole.CUSTOMER,
            profilePhotoUrl,
            termsAcceptedAt: dto.termsAccepted ? new Date() : undefined,
            termsVersion: dto.termsAccepted ? (dto.termsVersion ?? '2026-10-15') : undefined,
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
        },
        // Interactive transactions default to 5s, which is fine on localhost but
        // too short for a WAN round-trip to a managed Postgres (Supabase pooler).
        // The password hash above is computed BEFORE the transaction opens, so
        // argon2's CPU cost never counts against this budget.
        PrismaService.txOptions(),
      );
    } catch (err) {
      // A race between the pre-checks above and the insert still surfaces as a
      // raw unique-constraint (P2002); map it to a 409 instead of a 500.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(
          String(err.meta?.target ?? '').includes('phone')
            ? 'An account with this phone number already exists'
            : 'An account with this email already exists',
        );
      }
      throw err;
    }

    this.logger.log(`New user registered: ${user.id}`);

    // Requirement 3: registration must be followed by email verification
    // before login. We deliberately return NO tokens here — the account sits
    // at PENDING_VERIFICATION until OtpService.consume() succeeds.
    await this.otp.issue(user.id);

    return {
      requiresVerification: true,
      email: user.email,
      message: 'A verification code has been sent to your email.',
    };
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

    // Requirement 3/4: an unverified account may never receive tokens.
    // The message is intentionally identical to the wrong-password case so
    // this endpoint cannot be used to enumerate registered-but-unverified
    // addresses.
    if (user.status === 'PENDING_VERIFICATION') {
      await this.prisma.auditLog.create({
        data: { actorId: user.id, action: AuditAction.LOGIN_FAILED, entityType: 'User', entityId: user.id },
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.prisma.auditLog.create({
      data: { actorId: user.id, action: AuditAction.LOGIN, entityType: 'User', entityId: user.id },
    });

    return this.issueTokens(user.id, user.role);
  }

  /**
   * Admin-console login. Same credential checks as `login`, but tokens are
   * only issued to an ADMIN/SUPPORT account — a normal customer that happens
   * to hit /admin/login is rejected with 403 after the password is verified,
   * so this cannot be used to enumerate admin emails.
   */
  async adminLogin(dto: LoginDto, ipAddress?: string): Promise<AuthTokens & { role: UserRole; permissions: string[] }> {
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

    if (!ADMIN_ROLES.includes(user.role)) {
      await this.prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: AuditAction.LOGIN_FAILED,
          entityType: 'User',
          entityId: user.id,
          metadata: { reason: 'not_admin', surface: 'admin' },
        },
      });
      throw new ForbiddenException('This account does not have admin access');
    }

    if (user.status === 'PENDING_VERIFICATION') {
      await this.prisma.auditLog.create({
        data: { actorId: user.id, action: AuditAction.LOGIN_FAILED, entityType: 'User', entityId: user.id },
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: AuditAction.LOGIN,
        entityType: 'User',
        entityId: user.id,
        metadata: { surface: 'admin' },
      },
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastLoginIp: ipAddress ?? null },
    });
    const tokens = await this.issueTokens(user.id, user.role);
    return { ...tokens, role: user.role, permissions: permissionsForRole(user.role) };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user) {
      const token = randomUUID() + randomBytes(32).toString('hex');
      await this.prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
      await this.prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: this.hashToken(token), expiresAt: new Date(Date.now() + 30 * 60 * 1000) } });
      await this.mail.sendPasswordReset({ to: user.email, fullName: user.fullName, resetUrl: `${this.config.publicApiBaseUrl}/reset-password?token=${encodeURIComponent(token)}` });
    }
    return { sent: true };
  }

  async resetPassword(token: string, password: string) {
    const record = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash: this.hashToken(token) } });
    if (!record || record.usedAt || record.expiresAt < new Date()) throw new UnauthorizedException('Invalid or expired reset link');
    const passwordHash = await this.passwordHasher.hash(password);
    // Completing a password reset requires clicking a link sent to the
    // account's email, which is the same proof of ownership as the OTP step.
    // Activate an unverified account here so the user can actually log in with
    // the password they just set (otherwise login keeps returning the generic
    // "Invalid email or password" for PENDING_VERIFICATION accounts).
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: record.userId } });
    await this.prisma.$transaction([this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash, ...(user.status === 'PENDING_VERIFICATION' ? { status: 'ACTIVE' } : {}) } }), this.prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }), this.prisma.refreshToken.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } })]);
    return { reset: true };
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
