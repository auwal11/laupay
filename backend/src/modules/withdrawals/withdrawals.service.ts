import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { AuditAction, LedgerReason, Prisma, WithdrawalStatus, WithdrawalRefundStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { InsufficientBalanceError, InsufficientWithdrawableBalanceError } from '../ledger/ledger.errors';
import { calculateWithdrawableBalance } from '../ledger/withdrawal-provenance';
import { SecurityService } from '../security/security.service';
import { RequestWithdrawalDto } from './dto/withdrawals.dto';
import { persistTransactionAlert } from '../notifications/transaction-alerts';

function naira(value: number | string) { return `₦${Number(value).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function mask(value: string) { return value.length > 4 ? `••••${value.slice(-4)}` : value; }

@Injectable()
export class WithdrawalsService {
  constructor(private readonly prisma: PrismaService, private readonly ledger: LedgerService, private readonly security: SecurityService, private readonly config: AppConfigService) {}

  private cachedBanks?: { banks: Array<{ code: string; name: string }>; expiresAt: number };
  private cachedToken?: { token: string; expiresAt: number };

  /**
   * Authoritative bank directory. Prefers WITHDRAWAL_BANKS_JSON when an ops
   * team pins it; otherwise reads the configured provider's bank list and
   * caches it for an hour. Withdrawals stay disabled when neither source is
   * available rather than showing an unverified hard-coded directory.
   */
  async listBanks() {
    if (this.config.withdrawalBanks.length) return this.config.withdrawalBanks;
    if (this.cachedBanks && this.cachedBanks.expiresAt > Date.now()) return this.cachedBanks.banks;
    if (!this.config.monnifyApiKey || !this.config.monnifySecretKey) return [];

    try {
      const token = await this.monnifyToken();
      const response = await fetch(`${this.config.monnifyBaseUrl.replace(/\/$/, '')}/api/v1/banks`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'LAUPAY/1.0 (+https://laupay.app)',
        },
      });
      const body = (await response.json().catch(() => ({}))) as {
        requestSuccessful?: boolean;
        responseBody?: Array<{ code?: string; name?: string }>;
      };
      const banks = (body.responseBody ?? [])
        .filter((bank): bank is { code: string; name: string } => !!bank.code && !!bank.name)
        .map((bank) => ({ code: bank.code, name: bank.name }));
      if (!response.ok || !body.requestSuccessful || banks.length === 0) return [];
      this.cachedBanks = { banks, expiresAt: Date.now() + 60 * 60 * 1000 };
      return banks;
    } catch {
      return [];
    }
  }

  private async monnifyToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 30_000) return this.cachedToken.token;
    const credentials = Buffer.from(`${this.config.monnifyApiKey}:${this.config.monnifySecretKey}`).toString('base64');
    const response = await fetch(`${this.config.monnifyBaseUrl.replace(/\/$/, '')}/api/v1/auth/login`, {
      method: 'POST',
      headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/json', 'User-Agent': 'LAUPAY/1.0 (+https://laupay.app)' },
      body: JSON.stringify({}),
    });
    const body = (await response.json().catch(() => ({}))) as { responseBody?: { accessToken?: string } };
    const token = body.responseBody?.accessToken;
    if (!response.ok || !token) throw new Error('Monnify auth failed');
    this.cachedToken = { token, expiresAt: Date.now() + 50 * 60 * 1000 };
    return token;
  }

  async request(userId: string, dto: RequestWithdrawalDto) {
    if (this.config.fulfillmentMode === 'live') throw new ServiceUnavailableException('Withdrawals are unavailable until a verified payout provider is configured');
    const banks = await this.listBanks();
    const bank = banks.find((item) => item.code === dto.bankCode || item.name.toLowerCase() === dto.bankName.trim().toLowerCase());
    if (!banks.length) throw new ServiceUnavailableException('Bank directory is temporarily unavailable');
    if (!bank) throw new BadRequestException('Select a supported bank from the bank directory');
    const existing = await this.prisma.withdrawal.findUnique({ where: { idempotencyKey: dto.idempotencyKey } });
    if (existing) { if (existing.userId !== userId) throw new ConflictException('Invalid idempotency key'); return this.toView(existing); }
    await this.security.verifyPin(userId, dto.pin);
    const amount = new Prisma.Decimal(dto.amount);
    const wallet = await this.prisma.walletAccount.findUnique({ where: { ownerId: userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');
    const withdrawable = await this.withdrawableBalance(wallet.id);
    if (withdrawable.lt(amount)) {
      throw new BadRequestException('Test credit is not withdrawable. Only funds from real deposits or approved earnings can be withdrawn.');
    }
    const reference = `WD-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;
    const withdrawal = await this.prisma.withdrawal.create({ data: { userId, reference, idempotencyKey: dto.idempotencyKey, amount, fee: 0, bankName: bank.name, bankCode: bank.code, accountName: dto.accountName.trim(), accountNumber: dto.accountNumber, accountVerified: false, status: WithdrawalStatus.PENDING } });
    try {
      const entry = await this.ledger.debitWithdrawal({ walletAccountId: wallet.id, amount: amount.toString(), reason: LedgerReason.WITHDRAWAL, narrative: `Withdrawal hold • ${reference}`, source: 'withdrawal_request', mode: this.config.fulfillmentMode, referenceType: 'Withdrawal', referenceId: withdrawal.id, idempotencyKey: `withdrawal:${withdrawal.id}` });
      await this.prisma.withdrawal.update({ where: { id: withdrawal.id }, data: { ledgerEntryId: entry.entryId } });
      await this.event(withdrawal.id, null, WithdrawalStatus.PENDING, 'REQUESTED', userId, 'Withdrawal request submitted');
    } catch (error) {
      await this.prisma.withdrawal.update({ where: { id: withdrawal.id }, data: { status: WithdrawalStatus.REJECTED, failureReason: 'Insufficient available balance' } });
      if (error instanceof InsufficientWithdrawableBalanceError) {
        throw new BadRequestException('Test credit is not withdrawable. Only funds from real deposits or approved earnings can be withdrawn.');
      }
      if (error instanceof InsufficientBalanceError) throw new BadRequestException('Insufficient balance for this withdrawal');
      throw error;
    }
    await this.audit(userId, withdrawal.id, { kind: 'withdrawal_request', reference, amount: amount.toString() });
    return this.toView(await this.prisma.withdrawal.findUniqueOrThrow({ where: { id: withdrawal.id } }));
  }

  /**
   * Test allocations are product-testing funds, never cash. They are spent
   * first, so only the remainder of non-test credits can back a withdrawal.
   * This also blocks withdrawn balances created before auto-credit was removed.
   */
  private async withdrawableBalance(walletAccountId: string): Promise<Prisma.Decimal> {
    const rows = await this.prisma.ledgerEntry.findMany({
      where: { walletAccountId },
      select: { direction: true, amount: true, source: true, mode: true, reason: true },
    });
    return calculateWithdrawableBalance(rows);
  }

  async listForUser(userId: string) { return (await this.prisma.withdrawal.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 100 })).map((row) => this.toView(row)); }
  async getForUser(userId: string, id: string) { const row = await this.prisma.withdrawal.findFirst({ where: { id, userId }, include: { events: { orderBy: { createdAt: 'asc' } }, refunds: true } }); if (!row) throw new NotFoundException('Withdrawal not found'); return { ...this.toView(row), events: row.events, refunds: row.refunds.map((r) => ({ ...r, amount: r.amount.toString() })) }; }
  async listAll(status?: WithdrawalStatus, search?: string) { const rows = await this.prisma.withdrawal.findMany({ where: { ...(status ? { status } : {}), ...(search ? { OR: [{ reference: { contains: search, mode: 'insensitive' } }, { accountName: { contains: search, mode: 'insensitive' } }, { accountNumber: { endsWith: search } }] } : {}) }, orderBy: { createdAt: 'desc' }, take: 100, include: { user: { select: { id: true, email: true, fullName: true } }, events: { orderBy: { createdAt: 'asc' } } } }); return rows.map((row) => ({ ...this.toView(row), user: row.user, events: row.events })); }
  async getAdmin(id: string) { const row = await this.prisma.withdrawal.findUnique({ where: { id }, include: { user: { select: { id: true, email: true, fullName: true } }, events: { orderBy: { createdAt: 'asc' } }, refunds: true, payoutAttempts: { orderBy: { createdAt: 'desc' } } } }); if (!row) throw new NotFoundException('Withdrawal not found'); return { ...this.toView(row), user: row.user, events: row.events, refunds: row.refunds.map((r) => ({ ...r, amount: r.amount.toString() })), payoutAttempts: row.payoutAttempts }; }

  approve(adminId: string, id: string, reason: string) { return this.transition(adminId, id, WithdrawalStatus.PENDING, WithdrawalStatus.APPROVED, 'APPROVED', reason, { approvedBy: adminId, approvedAt: new Date() }); }
  startProcessing(adminId: string, id: string, reason: string) { return this.transition(adminId, id, WithdrawalStatus.APPROVED, WithdrawalStatus.PROCESSING, 'PROCESSING', reason, { processedBy: adminId, processingAt: new Date() }); }
  markSuccessful(adminId: string, id: string, reason: string, providerReference: string, evidence: string) { if (!providerReference?.trim() || !evidence?.trim()) throw new BadRequestException('Provider reference and verification evidence are required'); return this.transition(adminId, id, WithdrawalStatus.PROCESSING, WithdrawalStatus.SUCCESSFUL, 'SETTLED', reason, { processedBy: adminId, settledAt: new Date(), providerReference: providerReference.trim(), verificationEvidence: evidence.trim() }); }
  reject(adminId: string, id: string, reason: string) { return this.refundAndTransition(adminId, id, [WithdrawalStatus.PENDING], WithdrawalStatus.REJECTED, reason, 'REJECTED'); }
  markFailed(adminId: string, id: string, reason: string) { return this.refundAndTransition(adminId, id, [WithdrawalStatus.PROCESSING, WithdrawalStatus.APPROVED], WithdrawalStatus.FAILED, reason, 'FAILED'); }
  refund(adminId: string, id: string, reason: string) { return this.refundAndTransition(adminId, id, [WithdrawalStatus.SUCCESSFUL, WithdrawalStatus.FAILED, WithdrawalStatus.REVERSED, WithdrawalStatus.REFUND_FAILED], WithdrawalStatus.REFUNDED, reason, 'REFUNDED'); }

  private async transition(adminId: string, id: string, from: WithdrawalStatus, to: WithdrawalStatus, action: string, reason: string, data: Prisma.WithdrawalUpdateInput) {
    if (!reason?.trim()) throw new BadRequestException('A reason is required');
    const existing = await this.prisma.withdrawal.findUnique({ where: { id }, select: { userId: true } });
    if (!existing) throw new NotFoundException('Withdrawal not found');
    if (existing.userId === adminId) throw new ForbiddenException('An administrator cannot approve their own withdrawal');
    const row = await this.prisma.$transaction(async (tx) => {
      const result = await tx.withdrawal.updateMany({ where: { id, status: from }, data: { ...data, status: to } });
      if (result.count !== 1) throw new ConflictException(`Withdrawal cannot move from ${from}`);
      const updated = await tx.withdrawal.findUniqueOrThrow({ where: { id } });
      await tx.withdrawalEvent.create({ data: { withdrawalId: id, fromStatus: from, toStatus: to, action, actorId: adminId, reason } });
      await this.persistStatusAlert(tx, updated, to, adminId, reason);
      return updated;
    });
    await this.audit(adminId, id, { action, from, to, reason });
    return this.toView(row);
  }

  private async persistStatusAlert(
    tx: Prisma.TransactionClient,
    withdrawal: { id: string; userId: string; reference: string; amount: Prisma.Decimal; updatedAt: Date },
    status: WithdrawalStatus,
    actorId: string,
    reason: string,
  ): Promise<void> {
    const title = `Withdrawal ${status.toLowerCase()}`;
    const body = `${naira(withdrawal.amount.toFixed(2))} withdrawal ${withdrawal.reference} is now ${status.toLowerCase()}.`;
    await persistTransactionAlert(tx, {
      eventKey: `withdrawal:${withdrawal.id}:status:${status}`,
      userId: withdrawal.userId,
      title,
      body,
      category: 'wallet',
      metadata: {
        alertType: 'STATUS_UPDATE',
        eventType: 'WITHDRAWAL_STATUS',
        withdrawalId: withdrawal.id,
        transactionReference: withdrawal.reference,
        amount: withdrawal.amount.toFixed(2),
        currency: 'NGN',
        status,
        date: withdrawal.updatedAt.toISOString(),
        actorId,
        narration: reason,
      },
      email: {
        alertType: 'STATUS_UPDATE',
        title,
        body,
        amount: withdrawal.amount.toFixed(2),
        currency: 'NGN',
        transactionReference: withdrawal.reference,
        status,
        date: withdrawal.updatedAt.toISOString(),
        narrative: reason,
        supportEmail: this.config.supportEmail,
      },
    });
  }

  private async refundAndTransition(adminId: string, id: string, allowed: WithdrawalStatus[], finalStatus: WithdrawalStatus, reason: string, action: string) {
    if (!reason?.trim()) throw new BadRequestException('A reason is required');
    const existing = await this.prisma.withdrawal.findUnique({ where: { id }, select: { userId: true } });
    if (!existing) throw new NotFoundException('Withdrawal not found');
    if (existing.userId === adminId) throw new ForbiddenException('An administrator cannot refund their own withdrawal');
    const claimed = await this.prisma.withdrawal.updateMany({ where: { id, status: { in: allowed } }, data: { status: WithdrawalStatus.REFUND_PENDING, failureReason: reason, processedBy: adminId } });
    if (claimed.count !== 1) throw new ConflictException('Withdrawal is not eligible for this action');
    const row = await this.prisma.withdrawal.findUniqueOrThrow({ where: { id } });
    try {
      const wallet = await this.prisma.walletAccount.findUniqueOrThrow({ where: { ownerId: row.userId } });
      const entry = await this.ledger.credit({ walletAccountId: wallet.id, amount: row.amount.toString(), reason: LedgerReason.REVERSAL, narrative: `Withdrawal refund • ${row.reference}`, source: 'withdrawal_refund', mode: this.config.fulfillmentMode, adminId, referenceType: 'Withdrawal', referenceId: id, idempotencyKey: `withdrawal-refund:${id}` });
      await this.prisma.withdrawalRefund.upsert({ where: { ledgerEntryId: entry.entryId }, create: { withdrawalId: id, ledgerEntryId: entry.entryId, amount: row.amount, status: WithdrawalRefundStatus.REFUNDED, reason, actorId: adminId, completedAt: new Date() }, update: { status: WithdrawalRefundStatus.REFUNDED, completedAt: new Date() } });
      const updated = await this.prisma.withdrawal.update({ where: { id }, data: { status: finalStatus, refundLedgerEntryId: entry.entryId, refundedAmount: row.amount, refundStatus: WithdrawalRefundStatus.REFUNDED, refundedAt: new Date() } });
      await this.event(id, WithdrawalStatus.REFUND_PENDING, finalStatus, action, adminId, reason); await this.audit(adminId, id, { action, to: finalStatus, reason, refundEntryId: entry.entryId });
      return this.toView(updated);
    } catch (error) {
      await this.prisma.withdrawal.update({ where: { id }, data: { status: WithdrawalStatus.REFUND_FAILED, refundStatus: WithdrawalRefundStatus.FAILED } }).catch(() => undefined); throw error;
    }
  }
  private async event(id: string, fromStatus: WithdrawalStatus | null, toStatus: WithdrawalStatus, action: string, actorId: string, reason?: string) { await this.prisma.withdrawalEvent.create({ data: { withdrawalId: id, fromStatus, toStatus, action, actorId, reason } }); }
  private async audit(actorId: string, entityId: string, metadata: Record<string, unknown>) { await this.prisma.auditLog.create({ data: { actorId, action: AuditAction.ADMIN_ACTION, entityType: 'Withdrawal', entityId, metadata: metadata as Prisma.InputJsonValue } }).catch(() => undefined); }
  private toView(row: any) { return { id: row.id, reference: row.reference, amount: row.amount.toFixed(2), fee: row.fee.toFixed(2), bankCode: row.bankCode ?? undefined, bankName: row.bankName, accountName: row.accountName, accountNumber: mask(row.accountNumber), accountVerified: row.accountVerified, status: row.status, providerReference: row.providerReference ?? undefined, failureReason: row.failureReason ?? undefined, refundAmount: row.refundedAmount?.toFixed(2) ?? '0.00', refundStatus: row.refundStatus ?? undefined, createdAt: row.createdAt, updatedAt: row.updatedAt, approvedAt: row.approvedAt ?? undefined, processingAt: row.processingAt ?? undefined, settledAt: row.settledAt ?? undefined, refundedAt: row.refundedAt ?? undefined }; }
}
