import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { AuditAction, LedgerReason, Prisma, WithdrawalStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { InsufficientBalanceError } from '../ledger/ledger.errors';
import { NotificationsService } from '../notifications/notifications.service';
import { SecurityService } from '../security/security.service';
import { RequestWithdrawalDto } from './dto/withdrawals.dto';

function formatNaira(amount: number | string): string {
  const value = Number(amount);
  return `₦${value.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function maskAccount(accountNumber: string): string {
  return accountNumber.length > 4 ? `••••${accountNumber.slice(-4)}` : accountNumber;
}

/**
 * Customer withdrawals. This is deliberately not a provider payout integration:
 * in test mode a request is accepted, the wallet is debited (funds held), and
 * the request stays PENDING for ops review. Live mode is refused until a real
 * payout provider is wired in — nothing here may pretend a transfer happened.
 */
@Injectable()
export class WithdrawalsService {
  private readonly logger = new Logger(WithdrawalsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly security: SecurityService,
    private readonly notifications: NotificationsService,
    private readonly config: AppConfigService,
  ) {}

  async request(userId: string, dto: RequestWithdrawalDto) {
    if (this.config.fulfillmentMode === 'live') {
      throw new ServiceUnavailableException('Withdrawals are not available yet');
    }

    const existing = await this.prisma.withdrawal.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
    });
    if (existing) {
      if (existing.userId !== userId) throw new BadRequestException('Invalid request reference');
      return this.toView(existing);
    }

    await this.security.verifyPin(userId, dto.pin);

    const amount = Math.round(Number(dto.amount) * 100) / 100;
    const wallet = await this.prisma.walletAccount.findUnique({ where: { ownerId: userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');
    if (Number(wallet.balance) < amount) {
      throw new BadRequestException('Insufficient balance for this withdrawal');
    }

    const reference = `WD-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;
    const withdrawal = await this.prisma.withdrawal.create({
      data: {
        userId,
        reference,
        idempotencyKey: dto.idempotencyKey,
        amount,
        bankName: dto.bankName.trim(),
        accountName: dto.accountName.trim(),
        accountNumber: dto.accountNumber,
        status: WithdrawalStatus.PENDING,
      },
    });

    try {
      const entry = await this.ledger.debit({
        walletAccountId: wallet.id,
        amount,
        reason: LedgerReason.WITHDRAWAL,
        narrative: `Withdrawal to ${withdrawal.bankName} • ${maskAccount(withdrawal.accountNumber)}`,
        source: 'withdrawal_request',
        mode: this.config.fulfillmentMode,
        referenceType: 'Withdrawal',
        referenceId: withdrawal.id,
        idempotencyKey: `withdrawal:${withdrawal.id}`,
      });
      await this.prisma.withdrawal.update({
        where: { id: withdrawal.id },
        data: { ledgerEntryId: entry.entryId },
      });
    } catch (error) {
      await this.prisma.withdrawal.updateMany({
        where: { id: withdrawal.id, status: WithdrawalStatus.PENDING },
        data: {
          status: WithdrawalStatus.REJECTED,
          failureReason: 'Could not hold the amount from your wallet',
          processedAt: new Date(),
        },
      });
      if (error instanceof InsufficientBalanceError) {
        throw new BadRequestException('Insufficient balance for this withdrawal');
      }
      throw error;
    }

    await this.notifications
      .create({
        userId,
        category: 'wallet',
        title: 'Withdrawal request received',
        body: `${formatNaira(amount)} withdrawal to ${withdrawal.accountName} (${maskAccount(withdrawal.accountNumber)}) is pending review.`,
        metadata: { withdrawalId: withdrawal.id, reference, status: 'PENDING' },
      })
      .catch(() => undefined);

    await this.prisma.auditLog
      .create({
        data: {
          actorId: userId,
          action: AuditAction.WALLET_ADJUSTMENT,
          entityType: 'Withdrawal',
          entityId: withdrawal.id,
          metadata: { kind: 'withdrawal_request', amount, reference, status: 'PENDING' },
        },
      })
      .catch(() => undefined);

    return this.toView(await this.prisma.withdrawal.findUniqueOrThrow({ where: { id: withdrawal.id } }));
  }

  async listForUser(userId: string) {
    const rows = await this.prisma.withdrawal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map((row) => this.toView(row));
  }

  async listAll(status?: WithdrawalStatus) {
    const rows = await this.prisma.withdrawal.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { user: { select: { email: true, fullName: true } } },
    });
    return rows.map((row) => ({
      ...this.toView(row),
      user: row.user,
    }));
  }

  async approve(adminId: string, id: string) {
    const withdrawal = await this.prisma.withdrawal.findUnique({ where: { id } });
    if (!withdrawal) throw new NotFoundException('Withdrawal not found');
    if (withdrawal.status !== WithdrawalStatus.PENDING) {
      throw new BadRequestException(`Withdrawal is already ${withdrawal.status.toLowerCase()}`);
    }
    const updated = await this.prisma.withdrawal.update({
      where: { id },
      data: { status: WithdrawalStatus.PAID, processedBy: adminId, processedAt: new Date() },
    });
    await this.notifications
      .create({
        userId: withdrawal.userId,
        category: 'wallet',
        title: 'Withdrawal approved',
        body: `${formatNaira(withdrawal.amount.toString())} withdrawal to ${withdrawal.accountName} (${maskAccount(withdrawal.accountNumber)}) has been approved.`,
        metadata: { withdrawalId: id, reference: withdrawal.reference, status: 'PAID' },
      })
      .catch(() => undefined);
    return this.toView(updated);
  }

  async reject(adminId: string, id: string, reason: string) {
    const withdrawal = await this.prisma.withdrawal.findUnique({ where: { id } });
    if (!withdrawal) throw new NotFoundException('Withdrawal not found');
    if (withdrawal.status !== WithdrawalStatus.PENDING) {
      throw new BadRequestException(`Withdrawal is already ${withdrawal.status.toLowerCase()}`);
    }

    const wallet = await this.prisma.walletAccount.findUnique({ where: { ownerId: withdrawal.userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');

    await this.ledger.credit({
      walletAccountId: wallet.id,
      amount: withdrawal.amount.toString(),
      reason: LedgerReason.REVERSAL,
      narrative: `Withdrawal reversal • ${withdrawal.reference}`,
      source: 'withdrawal_rejected',
      mode: this.config.fulfillmentMode,
      referenceType: 'Withdrawal',
      referenceId: withdrawal.id,
      idempotencyKey: `withdrawal-reject:${withdrawal.id}`,
    });

    const updated = await this.prisma.withdrawal.update({
      where: { id },
      data: {
        status: WithdrawalStatus.REJECTED,
        failureReason: reason,
        processedBy: adminId,
        processedAt: new Date(),
      },
    });
    await this.notifications
      .create({
        userId: withdrawal.userId,
        category: 'wallet',
        title: 'Withdrawal not completed',
        body: `${formatNaira(withdrawal.amount.toString())} was returned to your wallet. ${reason}`,
        metadata: { withdrawalId: id, reference: withdrawal.reference, status: 'REJECTED' },
      })
      .catch(() => undefined);
    return this.toView(updated);
  }

  private toView(row: {
    id: string;
    reference: string;
    amount: Prisma.Decimal;
    bankName: string;
    accountName: string;
    accountNumber: string;
    status: WithdrawalStatus;
    failureReason: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      reference: row.reference,
      amount: row.amount.toFixed(2),
      bankName: row.bankName,
      accountName: row.accountName,
      accountNumber: row.accountNumber,
      status: row.status,
      failureReason: row.failureReason ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
