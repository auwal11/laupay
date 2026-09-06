import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PasswordHasher } from '../auth/password-hasher.service';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export type RiskDecision = 'allow' | 'verify' | 'hold' | 'reject';

@Injectable()
export class SecurityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async getPinStatus(userId: string) {
    const record = await this.prisma.userSecurity.findUnique({ where: { userId } });
    const locked = !!(record?.pinLockedUntil && record.pinLockedUntil > new Date());
    return {
      hasPin: !!record?.pinHash,
      locked,
      lockedUntil: locked ? record!.pinLockedUntil : null,
    };
  }

  /** Sets a PIN for the first time. Rejects if one already exists — use changePin instead. */
  async setPin(userId: string, pin: string) {
    const existing = await this.prisma.userSecurity.findUnique({ where: { userId } });
    if (existing?.pinHash) {
      throw new ConflictException('A PIN is already set — use change-pin instead');
    }

    const pinHash = await this.passwordHasher.hash(pin);
    await this.prisma.userSecurity.upsert({
      where: { userId },
      create: { userId, pinHash, pinSetAt: new Date() },
      update: { pinHash, pinSetAt: new Date(), failedPinAttempts: 0, pinLockedUntil: null },
    });
    return { hasPin: true };
  }

  async changePin(userId: string, currentPin: string, newPin: string) {
    await this.assertPinCorrect(userId, currentPin); // enforces lockout + increments on failure
    const pinHash = await this.passwordHasher.hash(newPin);
    await this.prisma.userSecurity.update({
      where: { userId },
      data: { pinHash, pinSetAt: new Date(), failedPinAttempts: 0, pinLockedUntil: null },
    });
    return { hasPin: true };
  }

  /**
   * Used by step-up verification flows (e.g. confirming a purchase). Throws
   * on incorrect PIN or while locked out — callers should treat any thrown
   * error as "verification failed", not distinguish further to avoid
   * leaking lockout state to an attacker beyond the 429/403 already implied.
   */
  async verifyPin(userId: string, pin: string): Promise<void> {
    await this.assertPinCorrect(userId, pin);
  }

  private async assertPinCorrect(userId: string, pin: string): Promise<void> {
    const record = await this.prisma.userSecurity.findUnique({ where: { userId } });
    if (!record?.pinHash) {
      throw new UnauthorizedException('No PIN has been set for this account');
    }
    if (record.pinLockedUntil && record.pinLockedUntil > new Date()) {
      throw new ForbiddenException('PIN is temporarily locked due to too many failed attempts');
    }

    const correct = await this.passwordHasher.verify(record.pinHash, pin);
    if (!correct) {
      const attempts = record.failedPinAttempts + 1;
      const lockedUntil = attempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null;
      await this.prisma.userSecurity.update({
        where: { userId },
        data: { failedPinAttempts: attempts, pinLockedUntil: lockedUntil },
      });
      throw new UnauthorizedException('Incorrect PIN');
    }

    // Correct PIN — reset the failure counter.
    if (record.failedPinAttempts > 0) {
      await this.prisma.userSecurity.update({
        where: { userId },
        data: { failedPinAttempts: 0, pinLockedUntil: null },
      });
    }
  }

  /**
   * PLACEHOLDER risk assessment — always returns "allow". This exists only
   * to give apps/customer-web's purchase flow a real response shape
   * (riskDecision: "allow") to render against instead of only mock data,
   * per docs/decisions/0004-customer-web-integration-audit.md §3.3.
   *
   * This is NOT a real fraud/risk engine. It performs no analysis of the
   * order, user, device, or amount whatsoever. Do not treat its output as
   * a security control — no code anywhere should rely on this ever
   * returning anything other than "allow" until a real risk engine is
   * built and this comment is removed.
   */
  assessOrderRisk(): { decision: RiskDecision } {
    return { decision: 'allow' };
  }
}
