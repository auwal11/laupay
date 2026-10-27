import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  LedgerDirection,
  LedgerReason,
  OrderStatus,
  Prisma,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrdersService } from '../orders/orders.service';
import { SettingsService } from '../settings/settings.service';
import { RiskService } from '../risk/risk.service';
import { AppConfigService } from '../../config/app-config.service';

export interface AdminActor {
  adminId: string;
  ipAddress?: string;
  userAgent?: string;
}

const ADMIN_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.SUPPORT, UserRole.FINANCE, UserRole.VIEWER];

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function paginate(page = 1, pageSize = 25) {
  const take = Math.min(Math.max(pageSize || 25, 1), 200);
  const skip = (Math.max(page || 1, 1) - 1) * take;
  return { skip, take };
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Array<Record<string, unknown>>, columns: string[]): string {
  const header = columns.join(',');
  const body = rows.map((row) => columns.map((c) => csvEscape(row[c])).join(',')).join('\n');
  return `${header}\n${body}`;
}

/**
 * Bank-console operations: user lifecycle, ledger adjustments, order
 * settlement, disputes, kill switches, provider mode, reports.
 *
 * Rules enforced here (and surfaced in the UI):
 *  - every money/status/access change requires a written reason;
 *  - every change writes an immutable AuditLog row (before/after/reason/IP);
 *  - balances are only ever changed through LedgerService;
 *  - history is never deleted — corrections are reversals/refunds.
 */
@Injectable()
export class AdminOpsService {
  private readonly logger = new Logger(AdminOpsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly notifications: NotificationsService,
    private readonly orders: OrdersService,
    private readonly settings: SettingsService,
    private readonly risk: RiskService,
    private readonly config: AppConfigService,
  ) {}

  // =================================================================
  // Users
  // =================================================================
  async userDetail(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        walletAccount: true,
        security: { select: { pinSetAt: true, pinLockedUntil: true, failedPinAttempts: true, pinHash: true } },
        agentProfile: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const [orders, entries, disputes, notes, riskEvents, sessions] = await Promise.all([
      this.prisma.order.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 25 }),
      this.prisma.ledgerEntry.findMany({
        where: { walletAccount: { is: { ownerId: id } } },
        orderBy: { createdAt: 'desc' },
        take: 25,
      }),
      this.prisma.transactionDispute.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 10 }),
      this.prisma.adminNote.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        include: { admin: { select: { id: true, email: true, fullName: true } } },
      }),
      this.prisma.riskEvent.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 10 }),
      this.prisma.refreshToken.findMany({ where: { userId: id, revokedAt: null }, orderBy: { createdAt: 'desc' } }),
    ]);

    const { security, ...rest } = user;
    return {
      ...rest,
      hasPin: !!security?.pinHash,
      pinSetAt: security?.pinSetAt ?? null,
      pinLockedUntil: security?.pinLockedUntil ?? null,
      failedPinAttempts: security?.failedPinAttempts ?? 0,
      emailVerified: !!user.emailVerifiedAt,
      phoneVerified: !!user.phoneVerifiedAt,
      orders,
      transactions: entries.map((e) => ({ ...e, amount: e.amount.toString(), balanceAfter: e.balanceAfter.toString() })),
      disputes,
      notes,
      riskEvents,
      sessions: sessions.map((s) => ({ id: s.id, createdAt: s.createdAt, expiresAt: s.expiresAt })),
    };
  }

  async freezeUser(id: string, actor: AdminActor, reason: string) {
    return this.setUserStatus(id, UserStatus.FROZEN, actor, reason, 'user.freeze');
  }

  async unfreezeUser(id: string, actor: AdminActor, reason: string) {
    return this.setUserStatus(id, UserStatus.ACTIVE, actor, reason, 'user.unfreeze');
  }

  async closeUser(id: string, actor: AdminActor, reason: string) {
    return this.setUserStatus(id, UserStatus.CLOSED, actor, reason, 'user.close');
  }

  private async setUserStatus(id: string, status: UserStatus, actor: AdminActor, reason: string, action: string) {
    this.requireReason(reason);
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role !== UserRole.CUSTOMER && user.role !== UserRole.AGENT && status === UserStatus.CLOSED) {
      throw new ForbiddenException('Admin accounts cannot be closed from this screen');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        status,
        frozenReason: status === UserStatus.FROZEN ? reason : null,
        sessionsRevokedAt: new Date(),
      } as any,
    });

    // A frozen/closed account must not keep live sessions.
    if (status !== UserStatus.ACTIVE) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await this.notifications
      .create({
        userId: id,
        category: 'account',
        title: status === UserStatus.ACTIVE ? 'Account reactivated' : status === UserStatus.CLOSED ? 'Account closed' : 'Account frozen',
        body:
          status === UserStatus.ACTIVE
            ? 'Your LAUPAY account has been reactivated. You can transact again.'
            : status === UserStatus.CLOSED
              ? 'Your LAUPAY account has been closed. Contact support if you have questions.'
              : 'Your LAUPAY account has been frozen. New payments are blocked until support reviews it.',
        metadata: { status },
      })
      .catch(() => undefined);

    await this.writeAudit(actor, {
      action: AuditAction.ADMIN_ACTION,
      entityType: 'User',
      entityId: id,
      reason,
      before: { status: user.status },
      after: { status },
      metadata: { action },
    });
    return updated;
  }

  /** Invalidates the customer's transaction PIN; they must set a new one. */
  async resetPin(id: string, actor: AdminActor, reason: string) {
    this.requireReason(reason);
    const security = await this.prisma.userSecurity.findUnique({ where: { userId: id } });
    if (!security) throw new NotFoundException('This user has no PIN record');
    const revokedAt = new Date();
    await this.prisma.$transaction([
      this.prisma.userSecurity.update({
        where: { userId: id },
        data: { pinHash: null, pinSetAt: null, failedPinAttempts: 0, pinLockedUntil: null },
      }),
      this.prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt } }),
      this.prisma.user.update({ where: { id }, data: { sessionsRevokedAt: revokedAt } as any }),
    ]);
    await this.notifications
      .create({
        userId: id,
        category: 'security',
        title: 'Transaction PIN reset',
        body: 'Your transaction PIN was reset by support. Please sign in and set a new PIN before your next purchase.',
      })
      .catch(() => undefined);
    await this.writeAudit(actor, {
      action: AuditAction.ADMIN_ACTION,
      entityType: 'UserSecurity',
      entityId: id,
      reason,
      before: { hadPin: !!security.pinHash },
      after: { hadPin: false },
      metadata: { action: 'user.reset_pin' },
    });
    return { reset: true };
  }

  async forceLogout(id: string, actor: AdminActor, reason: string) {
    this.requireReason(reason);
    const revokedAt = new Date();
    const [result] = await this.prisma.$transaction([
      this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt },
      }),
      this.prisma.user.update({ where: { id }, data: { sessionsRevokedAt: revokedAt } as any }),
    ]);
    await this.writeAudit(actor, {
      action: AuditAction.ADMIN_ACTION,
      entityType: 'User',
      entityId: id,
      reason,
      metadata: { action: 'user.force_logout', revokedSessions: result.count },
    });
    return { revokedSessions: result.count };
  }

  async markVerified(id: string, field: 'email' | 'phone', actor: AdminActor, reason: string) {
    this.requireReason(reason);
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    const data: Prisma.UserUpdateInput =
      field === 'email'
        ? { emailVerifiedAt: new Date(), status: user.status === UserStatus.PENDING_VERIFICATION ? UserStatus.ACTIVE : user.status }
        : { phoneVerifiedAt: new Date() };
    const updated = await this.prisma.user.update({ where: { id }, data });
    await this.writeAudit(actor, {
      action: AuditAction.ADMIN_ACTION,
      entityType: 'User',
      entityId: id,
      reason,
      before: { [field === 'email' ? 'emailVerifiedAt' : 'phoneVerifiedAt']: null },
      after: { [field === 'email' ? 'emailVerifiedAt' : 'phoneVerifiedAt']: new Date().toISOString() },
      metadata: { action: 'user.mark_verified', field },
    });
    return updated;
  }

  async addNote(id: string, body: string, actor: AdminActor) {
    if (!body || body.trim().length < 2) throw new BadRequestException('Note is too short');
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    const note = await this.prisma.adminNote.create({
      data: { userId: id, adminId: actor.adminId, body: body.trim() },
      include: { admin: { select: { id: true, email: true, fullName: true } } },
    });
    await this.writeAudit(actor, {
      action: AuditAction.ADMIN_ACTION,
      entityType: 'User',
      entityId: id,
      reason: 'Internal note added',
      metadata: { action: 'user.add_note', noteId: note.id },
    });
    return note;
  }

  async setRole(id: string, role: string, actor: AdminActor, reason: string) {
    this.requireReason(reason);
    if (!Object.values(UserRole).includes(role as UserRole)) throw new BadRequestException('Invalid role');
    if (role === UserRole.CUSTOMER || role === UserRole.AGENT) {
      throw new BadRequestException('Use customer/agent onboarding flows to change non-admin roles');
    }
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    const sessionsRevokedAt = new Date();
    const updated = await this.prisma.user.update({ where: { id }, data: { role: role as UserRole, sessionsRevokedAt } as any });
    await this.writeAudit(actor, {
      action: AuditAction.ADMIN_ACTION,
      entityType: 'User',
      entityId: id,
      reason,
      before: { role: user.role },
      after: { role },
      metadata: { action: 'user.set_role' },
    });
    return updated;
  }

  // =================================================================
  // Wallets & ledger
  // =================================================================
  private async walletFor(userId: string) {
    const wallet = await this.prisma.walletAccount.findUnique({ where: { ownerId: userId } });
    if (!wallet) throw new NotFoundException('Wallet not found for this user');
    return wallet;
  }

  async creditWallet(userId: string, amount: number, reason: string, note: string | undefined, actor: AdminActor, idempotencyKey: string) {
    this.requireReason(reason);
    this.requireIdempotencyKey(idempotencyKey);
    this.rejectSelfFinancialAction(userId, actor.adminId);
    if (!(amount > 0)) throw new BadRequestException('Amount must be greater than zero');
    const wallet = await this.walletFor(userId);
    const mode = await this.settings.effectiveFulfillmentMode();
    const entry = await this.ledger.credit({
      walletAccountId: wallet.id,
      amount,
      reason: LedgerReason.ADMIN_ADJUSTMENT,
      narrative: note?.trim() || `Admin credit — ${reason.trim()}`,
      source: mode === 'live' ? 'admin_credit' : 'admin_test_credit',
      mode: mode === 'live' ? 'live' : 'test',
      adminId: actor.adminId,
      referenceType: 'AdminAdjustment',
      referenceId: actor.adminId,
      idempotencyKey: `ledger:admin-credit:${idempotencyKey}`,
    });
    await this.notifications
      .create({
        userId,
        category: 'wallet',
        title: mode === 'live' ? 'Wallet credited' : 'Test credit added',
        body:
          mode === 'live'
            ? `Your wallet was credited with ₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}.`
            : `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })} test credit was added by Ibrahim Lau Provision Shop.`,
        metadata: { entryId: entry.entryId, reason },
      })
      .catch(() => undefined);
    await this.writeAudit(actor, {
      action: AuditAction.WALLET_ADJUSTMENT,
      entityType: 'WalletAccount',
      entityId: wallet.id,
      reason,
      before: { balance: wallet.balance.toString() },
      after: { balance: entry.balanceAfter },
      metadata: { action: 'wallet.credit', amount, userId, entryId: entry.entryId, test: mode !== 'live' },
    });
    return entry;
  }

  async debitWallet(userId: string, amount: number, reason: string, note: string | undefined, actor: AdminActor, idempotencyKey: string) {
    this.requireReason(reason);
    this.requireIdempotencyKey(idempotencyKey);
    this.rejectSelfFinancialAction(userId, actor.adminId);
    if (!(amount > 0)) throw new BadRequestException('Amount must be greater than zero');
    const wallet = await this.walletFor(userId);
    const entry = await this.ledger.debit({
      walletAccountId: wallet.id,
      amount,
      reason: LedgerReason.ADMIN_ADJUSTMENT,
      narrative: note?.trim() || `Admin debit — ${reason.trim()}`,
      source: 'admin_debit',
      adminId: actor.adminId,
      referenceType: 'AdminAdjustment',
      referenceId: actor.adminId,
      idempotencyKey: `ledger:admin-debit:${idempotencyKey}`,
    });
    await this.notifications
      .create({
        userId,
        category: 'wallet',
        title: 'Wallet adjusted',
        body: `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })} was debited from your wallet by support.`,
        metadata: { entryId: entry.entryId, reason },
      })
      .catch(() => undefined);
    await this.writeAudit(actor, {
      action: AuditAction.WALLET_ADJUSTMENT,
      entityType: 'WalletAccount',
      entityId: wallet.id,
      reason,
      before: { balance: wallet.balance.toString() },
      after: { balance: entry.balanceAfter },
      metadata: { action: 'wallet.debit', amount, userId, entryId: entry.entryId },
    });
    return entry;
  }

  async debitWalletBalance(userId: string, reason: string, note: string | undefined, actor: AdminActor, idempotencyKey: string) {
    this.requireIdempotencyKey(idempotencyKey);
    const wallet = await this.walletFor(userId);
    const amount = Number(wallet.balance);
    if (!(amount > 0)) throw new BadRequestException('This wallet has no available balance to debit');
    return this.debitWallet(userId, amount, reason, note, actor, idempotencyKey);
  }

  private requireIdempotencyKey(value: string) {
    if (!value || value.trim().length < 16 || value.length > 128) {
      throw new BadRequestException('A unique idempotency key is required for wallet adjustments');
    }
  }

  private rejectSelfFinancialAction(userId: string, adminId: string) {
    if (userId === adminId) throw new ForbiddenException('An administrator cannot adjust their own wallet');
  }

  async reverseEntry(entryId: string, reason: string, actor: AdminActor) {
    this.requireReason(reason);
    const original = await this.prisma.ledgerEntry.findUnique({
      where: { id: entryId },
      include: { walletAccount: true },
    });
    if (!original) throw new NotFoundException('Ledger entry not found');
    if (original.walletAccount.ownerId === actor.adminId) {
      throw new ForbiddenException('An administrator cannot reverse their own wallet entry');
    }
    if (original.reason === LedgerReason.REVERSAL) {
      throw new ConflictException('A reversal entry cannot be reversed again');
    }
    const priorReversal = await this.prisma.ledgerEntry.findFirst({
      where: {
        reason: LedgerReason.REVERSAL,
        OR: [
          { referenceType: 'LedgerEntry', referenceId: original.id },
          ...(original.referenceType && original.referenceId
            ? [{ referenceType: original.referenceType, referenceId: original.referenceId }]
            : []),
        ],
      },
      select: { id: true },
    });
    if (priorReversal) throw new ConflictException('This ledger entry has already been reversed or refunded');
    if (original.referenceType === 'Order' && original.referenceId) {
      const disputeRefund = await this.prisma.transactionDispute.findFirst({
        where: { ledgerEntryId: original.id, refundEntryId: { not: null } },
        select: { id: true },
      });
      if (disputeRefund) throw new ConflictException('This transaction has already been refunded through a dispute');
    }
    const result = await this.ledger.reverse(original.id, `ledger:reversal:${original.id}:admin`);
    await this.writeAudit(actor, {
      action: AuditAction.WALLET_ADJUSTMENT,
      entityType: 'LedgerEntry',
      entityId: original.id,
      reason,
      before: { direction: original.direction, amount: original.amount.toString(), balanceAfter: original.balanceAfter.toString() },
      after: { reversalEntryId: result.entryId, balanceAfter: result.balanceAfter },
      metadata: { action: 'ledger.reverse', walletAccountId: original.walletAccountId },
    });
    return result;
  }

  async floatSummary() {
    const [aggregate, walletCount, byType] = await Promise.all([
      this.prisma.walletAccount.aggregate({ _sum: { balance: true } }),
      this.prisma.walletAccount.count(),
      this.prisma.walletAccount.groupBy({ by: ['ownerType'], _sum: { balance: true } }),
    ]);
    return {
      totalCustomerLiabilities: (aggregate._sum.balance ?? new Prisma.Decimal(0)).toString(),
      walletCount,
      byOwnerType: byType.map((b) => ({ ownerType: b.ownerType, balance: (b._sum.balance ?? new Prisma.Decimal(0)).toString() })),
      currency: 'NGN',
    };
  }

  async dailyReconciliation(from?: string, to?: string) {
    const fromDate = from ? new Date(from) : startOfToday();
    const toDate = to ? new Date(to) : new Date();
    const where: Prisma.OrderWhereInput = { createdAt: { gte: fromDate, lte: toDate } };
    const [fulfilled, failed, refunded, byType, debits, credits] = await Promise.all([
      this.prisma.order.aggregate({ where: { ...where, status: OrderStatus.FULFILLED }, _sum: { amount: true }, _count: { _all: true } }),
      this.prisma.order.count({ where: { ...where, status: { in: [OrderStatus.FULFILLMENT_FAILED, OrderStatus.CANCELLED] } } }),
      this.prisma.order.aggregate({ where: { ...where, status: OrderStatus.REFUNDED }, _sum: { amount: true }, _count: { _all: true } }),
      this.prisma.order.groupBy({ by: ['type'], where, _sum: { amount: true }, _count: { _all: true } }),
      this.prisma.ledgerEntry.aggregate({ where: { createdAt: { gte: fromDate, lte: toDate }, direction: LedgerDirection.DEBIT }, _sum: { amount: true } }),
      this.prisma.ledgerEntry.aggregate({ where: { createdAt: { gte: fromDate, lte: toDate }, direction: LedgerDirection.CREDIT }, _sum: { amount: true } }),
    ]);
    return {
      range: { from: fromDate.toISOString(), to: toDate.toISOString() },
      fulfilled: { count: fulfilled._count._all, amount: (fulfilled._sum.amount ?? 0).toString() },
      refunded: { count: refunded._count._all, amount: (refunded._sum.amount ?? 0).toString() },
      failedCount: failed,
      byType: byType.map((b) => ({ type: b.type, count: b._count._all, amount: (b._sum.amount ?? 0).toString() })),
      ledger: {
        debits: (debits._sum.amount ?? 0).toString(),
        credits: (credits._sum.amount ?? 0).toString(),
      },
    };
  }

  // =================================================================
  // Orders
  // =================================================================
  orderDetail(orderId: string) {
    return this.orders.adminOrderDetail(orderId);
  }

  retryOrder(orderId: string, actor: AdminActor) {
    return this.orders.adminRetryFulfillment(orderId, actor.adminId, actor.ipAddress);
  }

  markOrderSuccessful(orderId: string, actor: AdminActor, reason: string) {
    return this.orders.adminMarkSuccessful(orderId, actor.adminId, reason, actor.ipAddress);
  }

  markOrderFailed(orderId: string, actor: AdminActor, reason: string) {
    return this.orders.adminMarkFailed(orderId, actor.adminId, reason, actor.ipAddress);
  }

  async openDisputeForOrder(orderId: string, reason: string, details: string | undefined, actor: AdminActor) {
    this.requireReason(reason);
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    const debit = await this.prisma.ledgerEntry.findUnique({ where: { idempotencyKey: `ledger:order:${orderId}` } });
    if (!debit) throw new BadRequestException('This order was never debited, so there is nothing to dispute');
    const existing = await this.prisma.transactionDispute.findUnique({
      where: { userId_ledgerEntryId: { userId: order.userId, ledgerEntryId: debit.id } },
    });
    if (existing) throw new ConflictException('A dispute already exists for this order');
    const created = await this.prisma.transactionDispute.create({
      data: {
        caseReference: `DSP-${new Date().getUTCFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
        userId: order.userId,
        ledgerEntryId: debit.id,
        reason: 'OTHER',
        details: details?.trim() || reason.trim(),
        status: 'OPEN',
      },
    });
    await this.notifications.notifyAdmins({
      title: 'Dispute opened on an order',
      body: `An admin opened a dispute for order ${orderId}.`,
      category: 'system',
      metadata: { disputeId: created.id, orderId },
    });
    await this.writeAudit(actor, {
      action: AuditAction.ADMIN_ACTION,
      entityType: 'TransactionDispute',
      entityId: created.id,
      reason,
      metadata: { action: 'dispute.open_from_order', orderId, ledgerEntryId: debit.id },
    });
    return created;
  }

  // =================================================================
  // Disputes
  // =================================================================
  async disputeDetail(id: string) {
    const dispute = await this.prisma.transactionDispute.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, fullName: true, phone: true, status: true } },
        ledgerEntry: true,
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!dispute) throw new NotFoundException('Dispute not found');
    const order = dispute.ledgerEntry.referenceType === 'Order' && dispute.ledgerEntry.referenceId
      ? await this.prisma.order.findUnique({ where: { id: dispute.ledgerEntry.referenceId } })
      : null;
    const assignedAdmin = dispute.assignedAdminId
      ? await this.prisma.user.findUnique({ where: { id: dispute.assignedAdminId }, select: { id: true, email: true, fullName: true } })
      : null;
    return {
      ...dispute,
      // Flattened mirrors of the list payload so the console can render either.
      userName: dispute.user.fullName,
      userEmail: dispute.user.email,
      userPhone: dispute.user.phone,
      ledgerEntryId: dispute.ledgerEntryId,
      direction: dispute.ledgerEntry.direction,
      amount: dispute.ledgerEntry.amount.toString(),
      transactionCreatedAt: dispute.ledgerEntry.createdAt,
      ledgerReason: dispute.ledgerEntry.reason,
      ledgerEntry: {
        ...dispute.ledgerEntry,
        amount: dispute.ledgerEntry.amount.toString(),
        balanceAfter: dispute.ledgerEntry.balanceAfter.toString(),
      },
      order,
      assignedAdmin,
    };
  }

  async assignDispute(id: string, adminId: string, actor: AdminActor, reason: string) {
    this.requireReason(reason);
    const dispute = await this.prisma.transactionDispute.findUnique({ where: { id } });
    if (!dispute) throw new NotFoundException('Dispute not found');
    const updated = await this.prisma.transactionDispute.update({
      where: { id },
      data: { assignedAdminId: adminId, status: 'IN_REVIEW', lastActivityAt: new Date() },
    });
    await this.writeAudit(actor, {
      action: AuditAction.ADMIN_ACTION,
      entityType: 'TransactionDispute',
      entityId: id,
      reason,
      before: { assignedAdminId: dispute.assignedAdminId, status: dispute.status },
      after: { assignedAdminId: adminId, status: updated.status },
      metadata: { action: 'dispute.assign' },
    });
    return updated;
  }

  async addDisputeMessage(id: string, actor: AdminActor, body: string, internal: boolean) {
    if (!body || body.trim().length < 1) throw new BadRequestException('Message is empty');
    const dispute = await this.prisma.transactionDispute.findUnique({ where: { id } });
    if (!dispute) throw new NotFoundException('Dispute not found');
    const message = await this.prisma.disputeMessage.create({
      data: { disputeId: id, authorType: 'admin', authorId: actor.adminId, body: body.trim(), internal },
    });
    await this.prisma.transactionDispute.update({ where: { id }, data: { lastActivityAt: new Date() } });
    if (!internal) {
      await this.notifications
        .create({
          userId: dispute.userId,
          category: 'system',
          title: 'Update on your dispute',
          body: body.trim(),
          metadata: { disputeId: id, caseReference: dispute.caseReference },
        })
        .catch(() => undefined);
    }
    await this.writeAudit(actor, {
      action: AuditAction.ADMIN_ACTION,
      entityType: 'TransactionDispute',
      entityId: id,
      reason: internal ? 'Internal note added to dispute' : 'Customer-visible message sent',
      metadata: { action: 'dispute.message', internal, messageId: message.id },
    });
    return message;
  }

  async approveDisputeRefund(id: string, actor: AdminActor, reason: string, note?: string) {
    this.requireReason(reason);
    const dispute = await this.prisma.transactionDispute.findUnique({
      where: { id },
      include: { ledgerEntry: true },
    });
    if (!dispute) throw new NotFoundException('Dispute not found');
    if (dispute.userId === actor.adminId) throw new ForbiddenException('An administrator cannot refund their own dispute');
    if (!['OPEN', 'IN_REVIEW', 'REFUND_PENDING'].includes(dispute.status)) {
      throw new ConflictException('This dispute is not eligible for a refund');
    }
    if (dispute.refundEntryId) throw new ConflictException('This dispute has already been refunded');

    // Claim the dispute before touching the wallet. Without this claim-first
    // transition, a concurrent reject/status change could leave an orphan
    // wallet credit even though the dispute was no longer refundable.
    if ((dispute.status as string) !== 'REFUND_PENDING') {
      const claimed = await this.prisma.transactionDispute.updateMany({
        where: { id, status: { in: ['OPEN', 'IN_REVIEW'] }, refundEntryId: null },
        data: { status: 'REFUND_PENDING' as any, lastActivityAt: new Date() },
      });
      if (claimed.count !== 1) throw new ConflictException('This dispute is already being processed or resolved');
    } else {
      const existingRefund = await this.prisma.ledgerEntry.findUnique({
        where: { idempotencyKey: `ledger:dispute:${dispute.id}:refund` },
        select: { id: true },
      });
      if (!existingRefund) throw new ConflictException('This dispute refund is already being processed');
    }
    const wallet = await this.walletFor(dispute.userId);
    const amount = dispute.ledgerEntry.amount.toString();
    let entry;
    try {
      entry = await this.ledger.credit({
        walletAccountId: wallet.id,
        amount,
        reason: LedgerReason.ORDER_REFUND,
        narrative: note?.trim() || `Dispute refund — ${dispute.caseReference}`,
        source: 'dispute_refund',
        adminId: actor.adminId,
        referenceType: 'TransactionDispute',
        referenceId: dispute.id,
        idempotencyKey: `ledger:dispute:${dispute.id}:refund`,
      });
    } catch (error) {
      await this.prisma.transactionDispute.updateMany({
        where: { id, status: 'REFUND_PENDING' as any, refundEntryId: null },
        data: { status: 'IN_REVIEW', lastActivityAt: new Date() },
      }).catch(() => undefined);
      throw error;
    }
    const completed = await this.prisma.transactionDispute.updateMany({
      where: { id, status: 'REFUND_PENDING' as any, refundEntryId: null },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        lastActivityAt: new Date(),
        resolutionNote: note?.trim() || reason.trim(),
        refundEntryId: entry.entryId,
      },
    });
    if (completed.count !== 1) throw new ConflictException('This dispute was already resolved or refunded');
    const updated = await this.prisma.transactionDispute.findUniqueOrThrow({ where: { id } });
    await this.notifications
      .create({
        userId: dispute.userId,
        category: 'wallet',
        title: 'Dispute resolved — refund issued',
        body: `Your dispute ${dispute.caseReference} was approved. ₦${amount.toString()} has been returned to your wallet.`,
        metadata: { disputeId: dispute.id, entryId: entry.entryId },
      })
      .catch(() => undefined);
    await this.writeAudit(actor, {
      action: AuditAction.WALLET_ADJUSTMENT,
      entityType: 'TransactionDispute',
      entityId: id,
      reason,
      before: { status: dispute.status },
      after: { status: updated.status, refundEntryId: entry.entryId },
      metadata: { action: 'dispute.refund', amount: amount.toString(), caseReference: dispute.caseReference },
    });
    return { dispute: updated, refund: entry };
  }

  async rejectDispute(id: string, actor: AdminActor, reason: string, note?: string) {
    this.requireReason(reason);
    const dispute = await this.prisma.transactionDispute.findUnique({ where: { id } });
    if (!dispute) throw new NotFoundException('Dispute not found');
    if (['RESOLVED', 'REJECTED'].includes(dispute.status)) throw new ConflictException('Dispute already closed');
    const claimed = await this.prisma.transactionDispute.updateMany({
      where: { id, status: { in: ['OPEN', 'IN_REVIEW'] }, refundEntryId: null },
      data: {
        status: 'REJECTED',
        resolvedAt: new Date(),
        lastActivityAt: new Date(),
        resolutionNote: note?.trim() || reason.trim(),
      },
    });
    if (claimed.count !== 1) throw new ConflictException('This dispute is already being processed or resolved');
    const updated = await this.prisma.transactionDispute.findUniqueOrThrow({ where: { id } });
    await this.notifications
      .create({
        userId: dispute.userId,
        category: 'system',
        title: 'Dispute update',
        body: `Your dispute ${dispute.caseReference} was reviewed and could not be approved. ${note?.trim() || reason.trim()}`,
        metadata: { disputeId: dispute.id },
      })
      .catch(() => undefined);
    await this.writeAudit(actor, {
      action: AuditAction.ADMIN_ACTION,
      entityType: 'TransactionDispute',
      entityId: id,
      reason,
      before: { status: dispute.status },
      after: { status: updated.status },
      metadata: { action: 'dispute.reject', caseReference: dispute.caseReference },
    });
    return updated;
  }

  // =================================================================
  // Settings / kill switches / provider mode
  // =================================================================
  async updateSettings(values: Record<string, string>, actor: AdminActor, reason: string) {
    this.requireReason(reason);
    const before = await this.settings.snapshot();
    const result = await this.settings.setMany(values, actor.adminId);
    await this.writeAudit(actor, {
      action: AuditAction.ADMIN_ACTION,
      entityType: 'SystemSetting',
      entityId: 'settings',
      reason,
      before: before.settings,
      after: result.settings,
      metadata: { action: 'settings.update', keys: Object.keys(values) },
    });
    return result;
  }

  async setKillSwitch(key: string, enabled: boolean, actor: AdminActor, reason: string) {
    const allowed = ['service_airtime_enabled', 'service_data_enabled', 'service_wallet_funding_enabled', 'maintenance_mode'];
    if (!allowed.includes(key)) throw new BadRequestException('Unknown kill switch');
    this.requireReason(reason);
    // Stored as "enabled"; a kill switch ON means the service is paused.
    const stored = key === 'maintenance_mode' ? String(enabled) : String(!enabled);
    const previous = await this.settings.get(key);
    await this.settings.set(key, stored, actor.adminId);
    await this.writeAudit(actor, {
      action: AuditAction.ADMIN_ACTION,
      entityType: 'SystemSetting',
      entityId: key,
      reason,
      before: { paused: key === 'maintenance_mode' ? previous === 'true' : previous !== 'true' },
      after: { paused: enabled },
      metadata: { action: 'settings.kill_switch', key },
    });
    return this.settings.snapshot();
  }

  async switchProviderMode(target: string, confirmation: string, actor: AdminActor, reason: string) {
    if (!['simulated', 'provider_test', 'live'].includes(target)) {
      throw new BadRequestException('Invalid provider mode');
    }
    this.requireReason(reason);
    if (target === 'live' && confirmation !== 'CONFIRM') {
      throw new BadRequestException('Type CONFIRM to switch to live mode');
    }
    if (target === 'live' && this.config.isProduction === false) {
      throw new ForbiddenException('Live mode is only available in a production deployment');
    }
    const before = await this.settings.effectiveFulfillmentMode();
    await this.settings.set('provider_fulfillment_mode', target, actor.adminId);
    await this.writeAudit(actor, {
      action: AuditAction.ADMIN_ACTION,
      entityType: 'SystemSetting',
      entityId: 'provider_fulfillment_mode',
      reason,
      before: { mode: before },
      after: { mode: target },
      metadata: { action: 'providers.switch_mode', confirmation: target === 'live' ? 'CONFIRM' : undefined },
    });
    return this.settings.snapshot();
  }

  // =================================================================
  // Risk
  // =================================================================
  async blacklistPhone(phone: string, actor: AdminActor, reason: string) {
    this.requireReason(reason);
    const normalized = phone.trim();
    if (normalized.length < 7) throw new BadRequestException('Enter a valid phone number');
    const list = await this.settings.getBlacklistedPhones();
    if (!list.includes(normalized)) list.push(normalized);
    await this.settings.set('blacklist_phones', JSON.stringify(list), actor.adminId);
    await this.risk.record({
      type: 'BLACKLIST_ADDED',
      severity: 'warning',
      decision: 'block',
      metadata: { phone: normalized, adminId: actor.adminId },
    });
    await this.writeAudit(actor, {
      action: AuditAction.ADMIN_ACTION,
      entityType: 'SystemSetting',
      entityId: 'blacklist_phones',
      reason,
      after: { added: normalized },
      metadata: { action: 'risk.blacklist_phone' },
    });
    return { blacklist: list };
  }

  async unblacklistPhone(phone: string, actor: AdminActor, reason: string) {
    this.requireReason(reason);
    const list = (await this.settings.getBlacklistedPhones()).filter((p) => p !== phone.trim());
    await this.settings.set('blacklist_phones', JSON.stringify(list), actor.adminId);
    await this.writeAudit(actor, {
      action: AuditAction.ADMIN_ACTION,
      entityType: 'SystemSetting',
      entityId: 'blacklist_phones',
      reason,
      after: { removed: phone },
      metadata: { action: 'risk.unblacklist_phone' },
    });
    return { blacklist: list };
  }

  // =================================================================
  // Reports / CSV
  // =================================================================
  async report(from?: string, to?: string) {
    return this.dailyReconciliation(from, to);
  }

  async exportOrdersCsv(q: { status?: string; type?: string; search?: string; from?: string; to?: string }) {
    const where: Prisma.OrderWhereInput = {};
    if (q.status) where.status = q.status as OrderStatus;
    if (q.type) where.type = q.type as never;
    if (q.from || q.to) {
      where.createdAt = {
        ...(q.from ? { gte: new Date(q.from) } : {}),
        ...(q.to ? { lte: new Date(q.to) } : {}),
      };
    }
    if (q.search) {
      where.OR = [
        { id: { contains: q.search, mode: 'insensitive' } },
        { phoneNumber: { contains: q.search, mode: 'insensitive' } },
        { user: { is: { OR: [
          { email: { contains: q.search, mode: 'insensitive' } },
          { fullName: { contains: q.search, mode: 'insensitive' } },
        ] } } },
      ];
    }
    const rows = await this.prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10000,
      include: {
        user: { select: { email: true, fullName: true } },
        vtuTransaction: { select: { provider: true, status: true, providerReference: true } },
      },
    });
    return toCsv(
      rows.map((o) => ({
        id: o.id,
        createdAt: o.createdAt.toISOString(),
        user: o.user?.email ?? '',
        fullName: o.user?.fullName ?? '',
        type: o.type,
        network: o.network ?? '',
        destination: o.phoneNumber ?? '',
        amount: o.amount.toString(),
        status: o.status,
        failureReason: o.failureReason ?? '',
        provider: o.vtuTransaction?.provider ?? '',
        providerStatus: o.vtuTransaction?.status ?? '',
        providerReference: o.vtuTransaction?.providerReference ?? '',
      })),
      ['id', 'createdAt', 'user', 'fullName', 'type', 'network', 'destination', 'amount', 'status', 'failureReason', 'provider', 'providerStatus', 'providerReference'],
    );
  }

  async exportTransactionsCsv(q: { direction?: string; from?: string; to?: string; search?: string }) {
    const where: Prisma.LedgerEntryWhereInput = {};
    if (q.direction) where.direction = q.direction as LedgerDirection;
    if (q.from || q.to) {
      where.createdAt = {
        ...(q.from ? { gte: new Date(q.from) } : {}),
        ...(q.to ? { lte: new Date(q.to) } : {}),
      };
    }
    if (q.search) {
      where.OR = [
        { narrative: { contains: q.search, mode: 'insensitive' } },
        { referenceId: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    const rows = await this.prisma.ledgerEntry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10000,
      include: { walletAccount: { include: { user: { select: { email: true, fullName: true } } } } },
    });
    return toCsv(
      rows.map((e) => ({
        id: e.id,
        createdAt: e.createdAt.toISOString(),
        user: e.walletAccount.user?.email ?? '',
        fullName: e.walletAccount.user?.fullName ?? '',
        direction: e.direction,
        amount: e.amount.toString(),
        balanceAfter: e.balanceAfter.toString(),
        reason: e.reason,
        source: e.source ?? '',
        mode: e.mode ?? '',
        narrative: e.narrative ?? '',
        referenceType: e.referenceType ?? '',
        referenceId: e.referenceId ?? '',
      })),
      ['id', 'createdAt', 'user', 'fullName', 'direction', 'amount', 'balanceAfter', 'reason', 'source', 'mode', 'narrative', 'referenceType', 'referenceId'],
    );
  }

  // =================================================================
  // Helpers
  // =================================================================
  private requireReason(reason: string | undefined) {
    if (!reason || reason.trim().length < 5) {
      throw new BadRequestException('A written reason of at least 5 characters is required');
    }
  }

  private async writeAudit(
    actor: AdminActor,
    input: {
      action: AuditAction;
      entityType: string;
      entityId: string;
      reason: string;
      before?: unknown;
      after?: unknown;
      metadata?: Record<string, unknown>;
    },
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: actor.adminId,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId,
          reason: input.reason,
          before: (input.before as Prisma.InputJsonValue | undefined) ?? undefined,
          after: (input.after as Prisma.InputJsonValue | undefined) ?? undefined,
          metadata: (input.metadata as Prisma.InputJsonValue | undefined) ?? undefined,
          ipAddress: actor.ipAddress,
          userAgent: actor.userAgent,
        },
      });
    } catch (err) {
      // Audit failures must never silently pass unnoticed.
      this.logger.error(`AUDIT WRITE FAILED (${input.entityType} ${input.entityId}): ${String(err)}`);
    }
  }
}
