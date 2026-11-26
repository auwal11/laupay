import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PasswordHasher } from '../auth/password-hasher.service';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export type RiskDecision = 'allow' | 'verify' | 'hold' | 'reject';

@Injectable()
export class SecurityService {
  private readonly logger = new Logger(SecurityService.name);

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
    await this.assertPinCorrect(userId, currentPin, newPin);
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

  async getDevices(userId: string) {
    const sessions = await this.prisma.refreshToken.findMany({ where: { userId, revokedAt: null }, orderBy: { createdAt: 'desc' } });
    return sessions.map((session, index) => ({ id: session.id, label: index === 0 ? 'Current session' : 'Signed-in session', lastActiveAt: session.createdAt, isCurrent: index === 0, trusted: true }));
  }

  async revokeDevice(userId: string, id: string) {
    const result = await this.prisma.refreshToken.updateMany({ where: { id, userId, revokedAt: null }, data: { revokedAt: new Date() } });
    return { revoked: result.count === 1 };
  }

  async getNotifications(userId: string) {
    const logs = await this.prisma.auditLog.findMany({ where: { actorId: userId }, orderBy: { createdAt: 'desc' }, take: 20 });
    return logs.map((log) => ({ id: log.id, category: log.action === 'LOGIN_FAILED' ? 'security' : 'account', message: log.action.replace('_', ' ').toLowerCase(), createdAt: log.createdAt, read: true }));
  }

  private async assertPinCorrect(userId: string, pin: string, replacementPin?: string): Promise<void> {
    // A read/modify/write counter loses concurrent failures. Lock the one
    // per-user row before reading it so every failed attempt is serialized and
    // exactly the fifth concurrent/normal failure locks the account.
    const outcome = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ userId: string }>>`
        SELECT "userId" FROM "UserSecurity" WHERE "userId" = ${userId} FOR UPDATE
      `;
      const record = await tx.userSecurity.findUnique({ where: { userId } });
      if (!record?.pinHash) return 'missing';
      if (record.pinLockedUntil && record.pinLockedUntil > new Date()) return 'locked';

      const correct = await this.passwordHasher.verify(record.pinHash, pin);
      if (!correct) {
        const attempts = record.failedPinAttempts + 1;
        const lockedUntil = attempts >= MAX_FAILED_ATTEMPTS
          ? new Date(Date.now() + LOCKOUT_DURATION_MS)
          : null;
        await tx.userSecurity.update({
          where: { userId },
          data: { failedPinAttempts: attempts, pinLockedUntil: lockedUntil },
        });
        return attempts >= MAX_FAILED_ATTEMPTS ? 'locked' : 'incorrect';
      }

      if (replacementPin !== undefined) {
        const replacementHash = await this.passwordHasher.hash(replacementPin);
        await tx.userSecurity.update({
          where: { userId },
          data: { pinHash: replacementHash, pinSetAt: new Date(), failedPinAttempts: 0, pinLockedUntil: null },
        });
      } else if (record.failedPinAttempts > 0) {
        await tx.userSecurity.update({
          where: { userId },
          data: { failedPinAttempts: 0, pinLockedUntil: null },
        });
      }
      return 'ok';
    }, PrismaService.txOptions());

    if (outcome === 'missing') throw new BadRequestException('No PIN has been set for this account');
    if (outcome === 'locked') throw new ForbiddenException('PIN is temporarily locked due to too many failed attempts');
    if (outcome === 'incorrect') {
      // 403, not 401: the session is valid; only the step-up credential failed.
      throw new ForbiddenException('Incorrect PIN');
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
