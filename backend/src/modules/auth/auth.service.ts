import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuditAction, Prisma, User, UserRole, UserStatus, WalletOwnerType } from '@prisma/client';
import { randomUUID, randomBytes, createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AppConfigService } from '../../config/app-config.service';
import { PasswordHasher } from './password-hasher.service';
import { RegisterDto, LoginDto, VerifyOtpDto } from './dto/auth.dto';
import { OtpService } from './otp.service';
import { LoginThrottleService } from './login-throttle.service';
import { Inject } from '@nestjs/common';
import { MAIL_PROVIDER, MailProvider } from '../../common/mail/mail-provider.interface';
import { normalizeFullName } from '../../common/utils/name.util';
import { ADMIN_ROLES, permissionsForRole } from '../../common/permissions';
import { assertEmailAllowed, normalizeEmail } from '../../common/security/email-policy';

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
    private readonly loginThrottle: LoginThrottleService,
    @Inject(MAIL_PROVIDER) private readonly mail: MailProvider,
  ) {}

  /**
   * Verifies the emailed code, flips PENDING_VERIFICATION -> ACTIVE and only
   * then issues tokens (requirements 3 + 4). No code, no tokens.
   */
  async verifyEmail(dto: VerifyOtpDto, ip?: string) {
    const email = normalizeEmail(dto.email);
    await this.otp.assertVerifyAllowed(email, ip ?? 'unknown');
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Same message whether the email exists or the code is wrong.
    if (!user) throw new UnauthorizedException('Invalid or expired verification code');

    // OTP verification is only a registration transition. An already-active
    // account must authenticate through password login; accepting any code
    // here would be a complete account-takeover bypass. Suspended, frozen,
    // and closed accounts must never be reactivated through OTP either.
    if (user.status !== UserStatus.PENDING_VERIFICATION) {
      throw new UnauthorizedException('Invalid or expired verification code');
    }

    await this.otp.consume(user.id, dto.code);

    const activated = await this.prisma.user.update({
      where: { id: user.id },
      data: { status: 'ACTIVE', emailVerifiedAt: new Date() },
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

    return this.issueTokens(activated.id, activated.role);
  }

  async register(dto: RegisterDto, ipAddress?: string) {
    await this.otp.assertRegisterAllowed(ipAddress ?? 'unknown');
    if (dto.termsAccepted !== true) throw new ForbiddenException('Terms acceptance is required');
    const email = assertEmailAllowed(dto.email);
    const [existing, existingPhone] = await Promise.all([
      this.prisma.user.findUnique({ where: { email } }),
      dto.phone ? this.prisma.user.findUnique({ where: { phone: dto.phone } }) : Promise.resolve(null),
    ]);
    // Do not reveal whether either identity is registered. A duplicate gets
    // the same public response as a new pending registration, without issuing
    // another OTP or changing the existing account.
    if (existing || existingPhone) return this.registrationPendingResponse(email);

    const passwordHash = await this.passwordHasher.hash(dto.password);

    // User creation + wallet provisioning happen in one transaction: a user
    // must never exist without a corresponding wallet account, and vice versa.
    let user: User;
    try {
      user = await this.prisma.$transaction(
        async (tx) => {
          const created = await tx.user.create({
            data: {
              email,
              phone: dto.phone,
              passwordHash,
              fullName: normalizeFullName(dto.fullName),
              role: UserRole.CUSTOMER,
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
      // raw unique-constraint (P2002); preserve the same non-enumerating
      // response instead of exposing which identity collided.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return this.registrationPendingResponse(email);
      }
      throw err;
    }

    this.logger.log(`New user registered: ${user.id}`);

    // Requirement 3: registration must be followed by email verification
    // before login. We deliberately return NO tokens here — the account sits
    // at PENDING_VERIFICATION until OtpService.consume() succeeds.
    await this.otp.issue(user.id);

    return this.registrationPendingResponse(user.email);
  }

  private registrationPendingResponse(email: string) {
    return {
      requiresVerification: true,
      email,
      message: 'If an account can be created with these details, verification instructions will be sent.',
    };
  }

  async login(dto: LoginDto, ipAddress?: string) {
    const ip = ipAddress ?? 'unknown';
    const email = normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      const failure = await this.loginThrottle.recordFailure(email, ip, 'customer');
      await this.recordFailedLogin(email);
      if (failure.blocked) throw this.tooManyLogins();
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordOk = await this.passwordHasher.verify(user.passwordHash, dto.password);
    if (!passwordOk) {
      const failure = await this.loginThrottle.recordFailure(email, ip, 'customer');
      await this.recordFailedLogin(email, user.id);
      if (failure.blocked) throw this.tooManyLogins();
      throw new UnauthorizedException('Invalid email or password');
    }
    await this.loginThrottle.recordSuccess(email, 'customer');

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
  async adminLogin(dto: LoginDto, ipAddress?: string): Promise<AuthTokens & { role: UserRole; permissions: string[]; mustChangePassword: boolean }> {
    const ip = ipAddress ?? 'unknown';
    const email = normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      const failure = await this.loginThrottle.recordFailure(email, ip, 'admin');
      await this.recordFailedLogin(email);
      if (failure.blocked) throw this.tooManyLogins();
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordOk = await this.passwordHasher.verify(user.passwordHash, dto.password);
    if (!passwordOk) {
      const failure = await this.loginThrottle.recordFailure(email, ip, 'admin');
      await this.recordFailedLogin(email, user.id);
      if (failure.blocked) throw this.tooManyLogins();
      throw new UnauthorizedException('Invalid email or password');
    }
    await this.loginThrottle.recordSuccess(email, 'admin');

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
    return { ...tokens, role: user.role, permissions: permissionsForRole(user.role), mustChangePassword: Boolean((user as User & { mustChangePassword?: boolean }).mustChangePassword) };
  }

  async forgotPassword(rawEmail: string, ipAddress?: string) {
    const email = normalizeEmail(rawEmail);
    await this.otp.assertPasswordResetAllowed(email, ipAddress ?? 'unknown');
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
    const sessionsRevokedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      const claimedAt = new Date();
      const claimed = await tx.passwordResetToken.updateMany({
        where: { id: record.id, usedAt: null, expiresAt: { gt: claimedAt } },
        data: { usedAt: claimedAt },
      });
      if (claimed.count !== 1) throw new UnauthorizedException('Invalid or expired reset link');

      // A password-reset link changes credentials only. It is not an email
      // registration verification proof, so it must never activate a pending
      // account or bypass the mandatory registration OTP. The conditional
      // claim above makes the bearer token single-use under concurrent submits.
      await tx.user.update({
        where: { id: record.userId },
        data: { passwordHash, sessionsRevokedAt, mustChangePassword: false } as any,
      });
      await tx.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: sessionsRevokedAt },
      });
      await tx.auditLog.create({
        data: {
          actorId: record.userId,
          action: AuditAction.UPDATE,
          entityType: 'User',
          entityId: record.userId,
          metadata: { event: 'password.reset' },
        },
      });
    }, PrismaService.txOptions());
    return { reset: true };
  }

  /**
   * Changes the password for an authenticated user. Deliberately returns 400
   * (not 401) for a wrong current password: the web client treats any 401 as a
   * dead session and would log the user out of a form they just mistyped.
   * All refresh tokens are revoked on success, so a stolen session cannot
   * outlive the password it was created with.
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Invalid session');

    const currentOk = await this.passwordHasher.verify(user.passwordHash, currentPassword);
    if (!currentOk) throw new BadRequestException('Current password is incorrect');

    if (currentPassword === newPassword) {
      throw new BadRequestException('New password must be different from the current password');
    }

    const passwordHash = await this.passwordHasher.hash(newPassword);
    const sessionsRevokedAt = new Date();
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash, sessionsRevokedAt, mustChangePassword: false } as any }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: sessionsRevokedAt },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId: userId,
          action: AuditAction.UPDATE,
          entityType: 'User',
          entityId: userId,
          metadata: { event: 'password.change' },
        },
      }),
    ]);

    return { changed: true };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: stored.userId } });
    if (user.status !== UserStatus.ACTIVE) throw new UnauthorizedException('Account is not active');

    const accessToken = await this.jwt.signAsync(
      { sub: user.id, role: user.role },
      { secret: this.config.jwtAccessSecret, expiresIn: this.config.jwtAccessExpiresIn },
    );
    const nextRefreshToken = randomUUID() + randomBytes(32).toString('hex');
    const nextTokenHash = this.hashToken(nextRefreshToken);
    const expiresAt = new Date(Date.now() + this.config.jwtRefreshExpiresInDays * 24 * 60 * 60 * 1000);

    // The user row is the shared mutex for refresh and logout. The old token
    // claim and descendant creation commit together, so logout cannot miss a
    // just-rotated token between revoking the parent and inserting the child.
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "User" WHERE "id" = ${user.id} FOR UPDATE
      `;
      const currentUser = await tx.user.findUnique({ where: { id: user.id } });
      if (!currentUser || currentUser.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException('Account is not active');
      }
      const claimed = await tx.refreshToken.updateMany({
        where: { id: stored.id, tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
        data: { revokedAt: new Date() },
      });
      if (claimed.count !== 1) throw new UnauthorizedException('Invalid or expired refresh token');
      await tx.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: nextTokenHash,
          sessionFamilyId: stored.sessionFamilyId,
          expiresAt,
        },
      });
    }, PrismaService.txOptions());

    return { accessToken, refreshToken: nextRefreshToken };
  }

  async logout(refreshToken: string): Promise<{ revoked: boolean }> {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored) return { revoked: false };
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "User" WHERE "id" = ${stored.userId} FOR UPDATE
      `;
      const result = await tx.refreshToken.updateMany({
        where: { userId: stored.userId, sessionFamilyId: stored.sessionFamilyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return { revoked: result.count > 0 };
    }, PrismaService.txOptions());
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
      data: { userId, tokenHash, sessionFamilyId: randomUUID(), expiresAt },
    });

    return { accessToken, refreshToken: refreshTokenPlain };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }


  private tooManyLogins() {
    return new HttpException('Too many login attempts. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
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
