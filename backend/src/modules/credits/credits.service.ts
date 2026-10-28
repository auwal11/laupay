import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AuditAction, LedgerReason } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { NotificationsService } from '../notifications/notifications.service';

export const TEST_CREDIT_NARRATIVE = 'Test credit — Ibrahim Lau Provision Shop';

export interface GrantTestCreditOptions {
  adminId?: string;
  source?: string;
  mode?: string;
  ipAddress?: string;
  idempotencyKey?: string;
}

function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Owns the test-credit system and its runtime settings. Kept separate from
 * AdminModule so AuthModule and SecurityModule can trigger the *automatic*
 * grant (after verify + PIN) without importing the whole admin surface —
 * which would create a circular dependency.
 */
@Injectable()
export class CreditsService {
  private readonly logger = new Logger(CreditsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly notifications: NotificationsService,
  ) {}

  // ---------------------------------------------------------------
  // Settings (key/value). Defaults are deliberate and safe.
  // ---------------------------------------------------------------
  async getSetting(key: string, fallback: string): Promise<string> {
    const row = await this.prisma.systemSetting.findUnique({ where: { key } });
    return row?.value ?? fallback;
  }

  async setSetting(key: string, value: string, updatedBy?: string) {
    return this.prisma.systemSetting.upsert({
      where: { key },
      create: { key, value, updatedBy },
      update: { value, updatedBy },
    });
  }

  // ---------------------------------------------------------------
  // Admin-initiated grant
  // ---------------------------------------------------------------
  async grantTestCredit(userId: string, amount: number, opts: GrantTestCreditOptions = {}) {
    if (!(amount > 0)) throw new BadRequestException('Amount must be greater than zero');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const wallet = await this.prisma.walletAccount.findUnique({ where: { ownerId: userId } });
    if (!wallet) throw new NotFoundException('User wallet not found');

    const source = opts.source ?? 'test_allocation';
    const mode = opts.mode ?? 'test';
    const idempotencyKey = opts.idempotencyKey ?? `ledger:test-credit:${userId}:${randomUUID()}`;

    const entry = await this.ledger.credit({
      walletAccountId: wallet.id,
      amount,
      reason: LedgerReason.ADMIN_ADJUSTMENT,
      narrative: TEST_CREDIT_NARRATIVE,
      source,
      mode,
      adminId: opts.adminId,
      referenceType: 'AdminAdjustment',
      referenceId: opts.adminId,
      idempotencyKey,
    });

    await this.notifications.create({
      userId,
      category: 'wallet',
      title: 'Test credit added',
      body: `${formatNaira(amount)} test credit was added to your LAUPAY wallet by Ibrahim Lau Provision Shop for product testing.`,
      metadata: { amount, entryId: entry.entryId, source, mode },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: opts.adminId ?? null,
        action: AuditAction.WALLET_ADJUSTMENT,
        entityType: 'WalletAccount',
        entityId: wallet.id,
        ipAddress: opts.ipAddress,
        metadata: {
          kind: 'test_credit',
          amount,
          userId,
          entryId: entry.entryId,
          wasAlreadyApplied: entry.wasAlreadyApplied,
        },
      },
    });

    return entry;
  }

}
