import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { AuditAction, LedgerReason, Prisma, WithdrawalStatus, WithdrawalRefundStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { InsufficientBalanceError } from '../ledger/ledger.errors';
import { NotificationsService } from '../notifications/notifications.service';
import { SecurityService } from '../security/security.service';
import { RequestWithdrawalDto } from './dto/withdrawals.dto';

function naira(value: number | string) { return `₦${Number(value).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function mask(value: string) { return value.length > 4 ? `••••${value.slice(-4)}` : value; }

@Injectable()
export class WithdrawalsService {
  constructor(private readonly prisma: PrismaService, private readonly ledger: LedgerService, private readonly security: SecurityService, private readonly notifications: NotificationsService, private readonly config: AppConfigService) {}

  listBanks() { return this.config.withdrawalBanks; }

  async request(userId: string, dto: RequestWithdrawalDto) {
    if (this.config.fulfillmentMode === 'live') throw new ServiceUnavailableException('Withdrawals are unavailable until a verified payout provider is configured');
    const bank = this.config.withdrawalBanks.find((item) => item.code === dto.bankCode || item.name.toLowerCase() === dto.bankName.trim().toLowerCase());
    if (!this.config.withdrawalBanks.length) throw new ServiceUnavailableException('Bank directory is temporarily unavailable');
    if (!bank) throw new BadRequestException('Select a supported bank from the bank directory');
    const existing = await this.prisma.withdrawal.findUnique({ where: { idempotencyKey: dto.idempotencyKey } });
    if (existing) { if (existing.userId !== userId) throw new ConflictException('Invalid idempotency key'); return this.toView(existing); }
    await this.security.verifyPin(userId, dto.pin);
    const amount = new Prisma.Decimal(dto.amount);
    const wallet = await this.prisma.walletAccount.findUnique({ where: { ownerId: userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');
    const reference = `WD-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;
    const withdrawal = await this.prisma.withdrawal.create({ data: { userId, reference, idempotencyKey: dto.idempotencyKey, amount, fee: 0, bankName: bank.name, bankCode: bank.code, accountName: dto.accountName.trim(), accountNumber: dto.accountNumber, accountVerified: false, status: WithdrawalStatus.PENDING } });
    try {
      const entry = await this.ledger.debit({ walletAccountId: wallet.id, amount: amount.toString(), reason: LedgerReason.WITHDRAWAL, narrative: `Withdrawal hold • ${reference}`, source: 'withdrawal_request', mode: this.config.fulfillmentMode, referenceType: 'Withdrawal', referenceId: withdrawal.id, idempotencyKey: `withdrawal:${withdrawal.id}` });
      await this.prisma.withdrawal.update({ where: { id: withdrawal.id }, data: { ledgerEntryId: entry.entryId } });
      await this.event(withdrawal.id, null, WithdrawalStatus.PENDING, 'REQUESTED', userId, 'Withdrawal request submitted');
    } catch (error) {
      await this.prisma.withdrawal.update({ where: { id: withdrawal.id }, data: { status: WithdrawalStatus.REJECTED, failureReason: 'Insufficient available balance' } });
      if (error instanceof InsufficientBalanceError) throw new BadRequestException('Insufficient balance for this withdrawal');
      throw error;
    }
    await this.notifications.create({ userId, category: 'wallet', title: 'Withdrawal request received', body: `${naira(amount.toString())} is held pending review.`, metadata: { withdrawalId: withdrawal.id, reference, status: 'PENDING' } }).catch(() => undefined);
    await this.audit(userId, withdrawal.id, { kind: 'withdrawal_request', reference, amount: amount.toString() });
    return this.toView(await this.prisma.withdrawal.findUniqueOrThrow({ where: { id: withdrawal.id } }));
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
  refund(adminId: string, id: string, reason: string) { return this.refundAndTransition(adminId, id, [WithdrawalStatus.SUCCESSFUL, WithdrawalStatus.FAILED, WithdrawalStatus.REVERSED], WithdrawalStatus.REFUNDED, reason, 'REFUNDED'); }

  private async transition(adminId: string, id: string, from: WithdrawalStatus, to: WithdrawalStatus, action: string, reason: string, data: Prisma.WithdrawalUpdateInput) {
    if (!reason?.trim()) throw new BadRequestException('A reason is required');
    const result = await this.prisma.withdrawal.updateMany({ where: { id, status: from }, data });
    if (result.count !== 1) throw new ConflictException(`Withdrawal cannot move from ${from}`);
    await this.event(id, from, to, action, adminId, reason); await this.audit(adminId, id, { action, from, to, reason });
    const row = await this.prisma.withdrawal.findUniqueOrThrow({ where: { id } });
    await this.notifications.create({ userId: row.userId, category: 'wallet', title: `Withdrawal ${to.toLowerCase()}`, body: `${naira(row.amount.toString())} withdrawal is now ${to.toLowerCase()}.`, metadata: { withdrawalId: id, reference: row.reference, status: to } }).catch(() => undefined);
    return this.toView(row);
  }

  private async refundAndTransition(adminId: string, id: string, allowed: WithdrawalStatus[], finalStatus: WithdrawalStatus, reason: string, action: string) {
    if (!reason?.trim()) throw new BadRequestException('A reason is required');
    const claimed = await this.prisma.withdrawal.updateMany({ where: { id, status: { in: allowed } }, data: { status: WithdrawalStatus.REFUND_PENDING, failureReason: reason, processedBy: adminId } });
    if (claimed.count !== 1) throw new ConflictException('Withdrawal is not eligible for this action');
    const row = await this.prisma.withdrawal.findUniqueOrThrow({ where: { id } });
    try {
      const wallet = await this.prisma.walletAccount.findUniqueOrThrow({ where: { ownerId: row.userId } });
      const entry = await this.ledger.credit({ walletAccountId: wallet.id, amount: row.amount.toString(), reason: LedgerReason.REVERSAL, narrative: `Withdrawal refund • ${row.reference}`, source: 'withdrawal_refund', mode: this.config.fulfillmentMode, adminId, referenceType: 'Withdrawal', referenceId: id, idempotencyKey: `withdrawal-refund:${id}` });
      await this.prisma.withdrawalRefund.upsert({ where: { ledgerEntryId: entry.entryId }, create: { withdrawalId: id, ledgerEntryId: entry.entryId, amount: row.amount, status: WithdrawalRefundStatus.REFUNDED, reason, actorId: adminId, completedAt: new Date() }, update: { status: WithdrawalRefundStatus.REFUNDED, completedAt: new Date() } });
      const updated = await this.prisma.withdrawal.update({ where: { id }, data: { status: finalStatus, refundLedgerEntryId: entry.entryId, refundedAmount: row.amount, refundStatus: WithdrawalRefundStatus.REFUNDED, refundedAt: new Date() } });
      await this.event(id, WithdrawalStatus.REFUND_PENDING, finalStatus, action, adminId, reason); await this.audit(adminId, id, { action, to: finalStatus, reason, refundEntryId: entry.entryId });
      await this.notifications.create({ userId: row.userId, category: 'wallet', title: 'Withdrawal funds refunded', body: `${naira(row.amount.toString())} has been returned to your wallet.`, metadata: { withdrawalId: id, reference: row.reference, status: finalStatus, refundEntryId: entry.entryId } }).catch(() => undefined);
      return this.toView(updated);
    } catch (error) {
      await this.prisma.withdrawal.update({ where: { id }, data: { status: WithdrawalStatus.REFUND_FAILED, refundStatus: WithdrawalRefundStatus.FAILED } }).catch(() => undefined); throw error;
    }
  }
  private async event(id: string, fromStatus: WithdrawalStatus | null, toStatus: WithdrawalStatus, action: string, actorId: string, reason?: string) { await this.prisma.withdrawalEvent.create({ data: { withdrawalId: id, fromStatus, toStatus, action, actorId, reason } }); }
  private async audit(actorId: string, entityId: string, metadata: Record<string, unknown>) { await this.prisma.auditLog.create({ data: { actorId, action: AuditAction.ADMIN_ACTION, entityType: 'Withdrawal', entityId, metadata: metadata as Prisma.InputJsonValue } }).catch(() => undefined); }
  private toView(row: any) { return { id: row.id, reference: row.reference, amount: row.amount.toFixed(2), fee: row.fee.toFixed(2), bankCode: row.bankCode ?? undefined, bankName: row.bankName, accountName: row.accountName, accountNumber: mask(row.accountNumber), accountVerified: row.accountVerified, status: row.status, providerReference: row.providerReference ?? undefined, failureReason: row.failureReason ?? undefined, refundAmount: row.refundedAmount?.toFixed(2) ?? '0.00', refundStatus: row.refundStatus ?? undefined, createdAt: row.createdAt, updatedAt: row.updatedAt, approvedAt: row.approvedAt ?? undefined, processingAt: row.processingAt ?? undefined, settledAt: row.settledAt ?? undefined, refundedAt: row.refundedAt ?? undefined }; }
}
