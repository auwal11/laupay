import { HttpException, HttpStatus, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { createHash, randomInt } from 'crypto';
import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MAIL_PROVIDER, MailProvider } from '../../common/mail/mail-provider.interface';
import { Inject } from '@nestjs/common';

const OTP_TTL_MINUTES = 10;
const OTP_LENGTH = 6;
const RESEND_COOLDOWN_MS = 60_000;
const RESEND_WINDOW_MS = 60 * 60_000;

/**
 * Email OTP verification (requirements 3 + 4): a new user must verify their
 * address before login. There is no guest/demo bypass and no pre-created
 * session — `issueTokens` is only reachable once `consume()` succeeds.
 *
 * Security invariants:
 *  - Only the SHA-256 hash of the code is persisted (dump-safe).
 *  - Single-use: `consumedAt` is stamped inside a conditional UPDATE, so two
 *    concurrent submissions cannot both win.
 *  - Bounded attempts: `attempts` is incremented before comparison, and the
 *    row is refused once it reaches `maxAttempts` (6 digits = 10^6 space).
 *  - Throttled at the controller layer (see AuthController).
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    @Inject(MAIL_PROVIDER) private readonly mail: MailProvider,
  ) {}

  private static hash(code: string): string {
    return createHash('sha256').update(`laupay-otp:${code}`).digest('hex');
  }

  /** Issues a fresh code for a user, invalidating any prior outstanding one. */
  async issue(userId: string, purpose = 'REGISTRATION'): Promise<void> {
    const code = randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, '0');

    // Any prior unconsumed code for this user+purpose is superseded.
    await this.prisma.emailOtp.updateMany({
      where: { userId, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);
    await this.prisma.emailOtp.create({
      data: { userId, purpose, codeHash: OtpService.hash(code), expiresAt },
    });

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    await this.sendEmail(user.email, user.fullName, code);
    this.logger.log(`OTP issued for user ${userId} (purpose=${purpose})`);
  }

  /**
   * Verifies and consumes a code. Throws UnauthorizedException on any failure
   * with a deliberately vague message so the endpoint cannot be used to
   * enumerate accounts or distinguish "wrong code" from "expired".
   */
  async consume(userId: string, code: string, purpose = 'REGISTRATION'): Promise<void> {
    const invalid = new UnauthorizedException('Invalid or expired verification code');

    const otp = await this.prisma.emailOtp.findFirst({
      where: { userId, purpose, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) throw invalid;
    if (otp.lockedUntil && otp.lockedUntil > new Date()) {
      throw new HttpException('Too many attempts. Please request a new code later.', HttpStatus.TOO_MANY_REQUESTS);
    }

    // Conditional increment first — never trust a stale in-memory count.
    const updated = await this.prisma.emailOtp.updateMany({
      where: { id: otp.id, consumedAt: null, attempts: { lt: otp.maxAttempts } },
      data: { attempts: { increment: 1 } },
    });
    if (updated.count === 0) throw new HttpException('Code no longer valid. Request a new one.', HttpStatus.TOO_MANY_REQUESTS);

    if (otp.expiresAt.getTime() < Date.now()) throw invalid;
    if (OtpService.hash(code) !== otp.codeHash) {
      const nextAttempts = otp.attempts + 1;
      await this.prisma.auditLog.create({ data: { actorId: userId, action: 'LOGIN_FAILED', entityType: 'EmailOtp', entityId: otp.id, metadata: { reason: 'invalid_otp' } } });
      if (nextAttempts >= otp.maxAttempts) {
        await this.prisma.emailOtp.update({ where: { id: otp.id }, data: { consumedAt: new Date(), lockedUntil: new Date(Date.now() + 15 * 60_000) } });
        throw new HttpException('Code no longer valid. Request a new one.', HttpStatus.TOO_MANY_REQUESTS);
      }
      throw invalid;
    }

    // Atomic single-use claim: only one of two racing requests can win.
    const claimed = await this.prisma.emailOtp.updateMany({
      where: { id: otp.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (claimed.count === 0) throw invalid;

    this.logger.log(`OTP verified for user ${userId}`);
  }

  async assertResendAllowed(email: string, ip: string): Promise<void> {
    await this.checkRate(`resend:email:${email.trim().toLowerCase()}`, 'otp_resend_email', 5, RESEND_WINDOW_MS, RESEND_COOLDOWN_MS);
    await this.checkRate(`resend:ip:${ip}`, 'otp_resend_ip', 10, RESEND_WINDOW_MS, 0);
  }

  private async checkRate(key: string, category: string, max: number, windowMs: number, cooldownMs: number) {
    const now = new Date();
    const existing = await this.prisma.otpRateLimit.findUnique({ where: { key } });
    if (existing?.blockedUntil && existing.blockedUntil > now) throw new HttpException('Too many attempts. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
    const windowExpired = !existing || now.getTime() - existing.windowStartedAt.getTime() >= windowMs;
    if (existing && !windowExpired && cooldownMs > 0 && existing.lastAttemptAt && now.getTime() - existing.lastAttemptAt.getTime() < cooldownMs) {
      throw new HttpException('Too many attempts. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (existing && !windowExpired && existing.count >= max) {
      await this.prisma.otpRateLimit.update({ where: { key }, data: { blockedUntil: new Date(existing.windowStartedAt.getTime() + windowMs) } });
      throw new HttpException('Too many attempts. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (windowExpired) {
      await this.prisma.otpRateLimit.upsert({ where: { key }, create: { key, category, count: 1, windowStartedAt: now, lastAttemptAt: now }, update: { category, count: 1, windowStartedAt: now, lastAttemptAt: now, blockedUntil: null } });
    } else {
      await this.prisma.otpRateLimit.update({ where: { key }, data: { count: { increment: 1 }, lastAttemptAt: now } });
    }
  }

  /** Sends the 6-digit code through the configured MAIL_PROVIDER. */
  private async sendEmail(to: string, fullName: string, code: string): Promise<void> {
    await this.mail.sendVerificationCode({ to, fullName, code });
  }
}
