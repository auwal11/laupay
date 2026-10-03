import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { createHash, randomInt } from 'crypto';
import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MAIL_PROVIDER, MailProvider } from '../../common/mail/mail-provider.interface';
import { Inject } from '@nestjs/common';

const OTP_TTL_MINUTES = 10;
const OTP_LENGTH = 6;

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

    // Conditional increment first — never trust a stale in-memory count.
    const updated = await this.prisma.emailOtp.updateMany({
      where: { id: otp.id, consumedAt: null, attempts: { lt: otp.maxAttempts } },
      data: { attempts: { increment: 1 } },
    });
    if (updated.count === 0) throw invalid; // exhausted or consumed concurrently

    if (otp.expiresAt.getTime() < Date.now()) throw invalid;
    if (OtpService.hash(code) !== otp.codeHash) throw invalid;

    // Atomic single-use claim: only one of two racing requests can win.
    const claimed = await this.prisma.emailOtp.updateMany({
      where: { id: otp.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (claimed.count === 0) throw invalid;

    this.logger.log(`OTP verified for user ${userId}`);
  }

  /** Sends the 6-digit code through the configured MAIL_PROVIDER. */
  private async sendEmail(to: string, fullName: string, code: string): Promise<void> {
    await this.mail.sendVerificationCode({ to, fullName, code });
  }
}
