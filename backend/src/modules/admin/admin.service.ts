import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  AuditAction,
  LedgerDirection,
  LedgerReason,
  OrderStatus,
  Prisma,
  UserRole,
  UserStatus,
  WalletStatus,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AppConfigService } from '../../config/app-config.service';
import { CreditsService } from '../credits/credits.service';
import { SettingsService } from '../settings/settings.service';
import { RiskService } from '../risk/risk.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PasswordHasher } from '../auth/password-hasher.service';

const FULFILLMENT_RESOLVING = 'FULFILLMENT_RESOLVING' as unknown as OrderStatus;

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function paginate(page = 1, pageSize = 20) {
  const take = Math.min(Math.max(pageSize || 20, 1), 100);
  const skip = (Math.max(page || 1, 1) - 1) * take;
  return { skip, take };
}

/**
 * Read/write operations powering the admin console. Everything money-related
 * delegates to CreditsService (test credit) or the wallet status fields —
 * this service never writes a balance directly; the ledger remains the only
 * source of truth.
 */
@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly credits: CreditsService,
    private readonly settings: SettingsService,
    private readonly risk: RiskService,
    private readonly notifications: NotificationsService,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async createStaffAccount(
    emailInput: string,
    fullNameInput: string,
    roleInput: 'SUPPORT' | 'FINANCE' | 'VIEWER',
    reason: string,
    actorId: string,
    ipAddress?: string,
  ) {
    if (!this.config.superAdminIds.has(actorId)) {
      throw new ForbiddenException('Only a configured super administrator can create staff accounts');
    }
    if (!reason?.trim() || reason.trim().length < 5) {
      throw new BadRequestException('A written reason of at least 5 characters is required');
    }
    const email = emailInput.trim().toLowerCase();
    const fullName = fullNameInput.trim().replace(/\s+/g, ' ');
    if (!email || !fullName) throw new BadRequestException('Email and full name are required');
    const role = roleInput as UserRole;
    if (!( [UserRole.SUPPORT, UserRole.FINANCE, UserRole.VIEWER] as UserRole[]).includes(role)) {
      throw new BadRequestException('Only SUPPORT, FINANCE or VIEWER staff accounts can be created');
    }
    const existing = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) throw new ConflictException('An account with this email already exists');

    // The plain temporary password is returned once to the authenticated
    // super-admin and is never persisted or written to the audit log.
    const temporaryPassword = randomBytes(18).toString('base64url');
    const passwordHash = await this.passwordHasher.hash(temporaryPassword);
    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          fullName,
          passwordHash,
          role,
          status: UserStatus.ACTIVE,
          mustChangePassword: true,
        } as any,
        select: { id: true, email: true, fullName: true, role: true, status: true, createdAt: true },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: AuditAction.CREATE,
          entityType: 'User',
          entityId: user.id,
          ipAddress,
          reason: reason.trim(),
          metadata: { action: 'staff.create', role: user.role, email: user.email },
        },
      });
      return user;
    });
    return { user: { ...created, mustChangePassword: true }, temporaryPassword, warning: 'Show this temporary password only through a secure channel. It must be changed after first login.' };
  }

  // -----------------------------------------------------------------
  // Overview
  // -----------------------------------------------------------------
  async overview() {
    const [
      userCount,
      activeUserCount,
      walletCount,
      balanceAgg,
      orderCount,
      orderStatusGroups,
      pendingPayments,
      creditAgg,
      debitAgg,
      todayEntryCount,
      recentUsers,
      recentEntries,
      pendingVerification,
      blockedUsers,
      openDisputes,
      vtuGroups,
      paymentGroups,
      riskEventsToday,
      criticalRiskToday,
      timeoutMinutes,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
      this.prisma.walletAccount.count(),
      this.prisma.walletAccount.aggregate({ _sum: { balance: true } }),
      this.prisma.order.count(),
      this.prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.payment.count({ where: { status: { in: ['PENDING', 'PROCESSING', 'UNKNOWN'] } } }),
      this.prisma.ledgerEntry.aggregate({ _sum: { amount: true }, where: { direction: 'CREDIT' } }),
      this.prisma.ledgerEntry.aggregate({ _sum: { amount: true }, where: { direction: 'DEBIT' } }),
      this.prisma.ledgerEntry.count({ where: { createdAt: { gte: startOfToday() } } }),
      this.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, email: true, fullName: true, role: true, status: true, createdAt: true },
      }),
      this.prisma.ledgerEntry.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { walletAccount: { include: { user: { select: { id: true, email: true, fullName: true } } } } },
      }),
      this.prisma.user.count({ where: { status: UserStatus.PENDING_VERIFICATION } }),
      this.prisma.user.count({ where: { status: { in: [UserStatus.SUSPENDED, UserStatus.FROZEN, UserStatus.CLOSED] } } }),
      this.prisma.transactionDispute.count({ where: { status: { in: ['OPEN', 'IN_REVIEW'] } } }),
      this.prisma.vtuTransaction.groupBy({
        by: ['status'],
        where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        _count: { _all: true },
      }),
      this.prisma.payment.groupBy({
        by: ['status'],
        where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        _count: { _all: true },
      }),
      this.risk.topEventsToday(5),
      this.prisma.riskEvent.count({
        where: { createdAt: { gte: startOfToday() }, severity: 'critical' },
      }),
      this.settings.getNumber('order_timeout_minutes'),
    ]);

    const timeoutCutoff = new Date(Date.now() - (timeoutMinutes > 0 ? timeoutMinutes : 15) * 60_000);
    const stuckOrders = await this.prisma.order.count({
      where: {
        status: {
          in: [
            OrderStatus.CREATED,
            OrderStatus.PAID,
            OrderStatus.FULFILLING,
            OrderStatus.FULFILLMENT_UNKNOWN,
            FULFILLMENT_RESOLVING,
          ],
        },
        createdAt: { lt: timeoutCutoff },
      },
    });
    const countBy = (groups: Array<{ status: string; _count: { _all: number } }>) =>
      Object.fromEntries(groups.map((g) => [g.status, g._count._all]));
    const vtu24 = countBy(vtuGroups as never);
    const pay24 = countBy(paymentGroups as never);
    const vtuTotal = Object.values(vtu24).reduce((a, b) => a + b, 0);

    const ordersByStatus = Object.fromEntries(
      orderStatusGroups.map((g) => [g.status, g._count._all]),
    );

    return {
      fulfillmentMode: this.config.fulfillmentMode,
      users: {
        total: userCount,
        active: activeUserCount,
        pendingVerification,
        blocked: blockedUsers,
      },
      wallets: {
        total: walletCount,
        aggregateBalance: (balanceAgg._sum.balance ?? new Prisma.Decimal(0)).toString(),
        currency: 'NGN',
      },
      orders: { total: orderCount, byStatus: ordersByStatus },
      payments: { pendingOrUnknown: pendingPayments },
      ledger: {
        totalCredits: (creditAgg._sum.amount ?? new Prisma.Decimal(0)).toString(),
        totalDebits: (debitAgg._sum.amount ?? new Prisma.Decimal(0)).toString(),
        entriesToday: todayEntryCount,
      },
      providers: this.providerStatus(),
      providerHealth: this.buildProviderHealth(
        vtu24,
        pay24,
        vtuTotal,
        await this.settings.effectiveFulfillmentMode(),
        await this.settings.effectivePaymentProvider(),
      ),
      attention: {
        pendingPayments,
        stuckOrders,
        openDisputes,
        failedVtu24h: (vtu24.FAILED ?? 0) + (vtu24.UNKNOWN ?? 0),
        criticalRiskToday,
      },
      riskEventsToday,
      recentUsers,
      recentTransactions: recentEntries.map((e) => this.mapEntry(e)),
    };
  }

  private buildProviderHealth(
    vtu24: Record<string, number>,
    pay24: Record<string, number>,
    vtuTotal: number,
    fulfillmentMode: string,
    paymentProvider: string,
  ) {
    const succeeded = (vtu24.SUCCESS ?? 0) + (pay24.SUCCESS ?? 0);
    const failed = (vtu24.FAILED ?? 0) + (pay24.FAILED ?? 0) + (vtu24.UNKNOWN ?? 0) + (pay24.UNKNOWN ?? 0);
    const attempted = succeeded + failed + (vtu24.PROCESSING ?? 0) + (pay24.PROCESSING ?? 0) + (vtu24.PENDING ?? 0) + (pay24.PENDING ?? 0);
    return {
      window: '24h',
      vtu: {
        provider: this.config.vtuProvider,
        mode: fulfillmentMode,
        total: vtuTotal,
        success: vtu24.SUCCESS ?? 0,
        failed: vtu24.FAILED ?? 0,
        unknown: vtu24.UNKNOWN ?? 0,
        processing: vtu24.PROCESSING ?? 0,
      },
      payments: {
        provider: paymentProvider,
        success: pay24.SUCCESS ?? 0,
        failed: pay24.FAILED ?? 0,
        pending: (pay24.PENDING ?? 0) + (pay24.PROCESSING ?? 0),
      },
      successRate: attempted > 0 ? Math.round((succeeded / attempted) * 1000) / 10 : null,
      failureCount: failed,
      // We do not persist provider call latency; exposing a fabricated number
      // would be misleading, so this is explicitly null until instrumented.
      avgLatencyMs: null,
    };
  }

  providerStatus() {
    return {
      vtuProvider: this.config.vtuProvider,
      paymentProvider: this.config.paymentProvider,
      payoutProvider: 'none',
      vtpassConfigured: !!this.config.vtpassApiKey && !!this.config.vtpassSecretKey,
      paystackConfigured: !!this.config.paystackSecretKey,
      monnifyConfigured: !!this.config.monnifyApiKey && !!this.config.monnifySecretKey,
    };
  }

  // -----------------------------------------------------------------
  // Users
  // -----------------------------------------------------------------
  async listUsers(q: {
    search?: string;
    role?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }) {
    const where: Prisma.UserWhereInput = {};
    if (q.role) where.role = q.role as never;
    if (q.status) where.status = q.status as UserStatus;
    if (q.search) {
      where.OR = [
        { email: { contains: q.search, mode: 'insensitive' } },
        { fullName: { contains: q.search, mode: 'insensitive' } },
        { phone: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    const { skip, take } = paginate(q.page, q.pageSize);
    const [total, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          email: true,
          phone: true,
          fullName: true,
          role: true,
          status: true,
          profilePhotoUrl: true,
          testCreditGrantedAt: true,
          createdAt: true,
          walletAccount: { select: { id: true, balance: true, status: true, currency: true } },
          security: { select: { pinHash: true } },
        },
      }),
    ]);
    return {
      total,
      page: q.page ?? 1,
      pageSize: take,
      items: rows.map((u) => {
        const { security, ...rest } = u;
        return { ...rest, hasPin: !!security?.pinHash };
      }),
    };
  }

  async getUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        phone: true,
        fullName: true,
        role: true,
        status: true,
        profilePhotoUrl: true,
        testCreditGrantedAt: true,
        createdAt: true,
        updatedAt: true,
        walletAccount: true,
        security: { select: { pinHash: true, pinSetAt: true, pinLockedUntil: true, failedPinAttempts: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const [orders, entries] = await Promise.all([
      this.prisma.order.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 10 }),
      this.prisma.ledgerEntry.findMany({
        where: { walletAccount: { is: { ownerId: id } } },
        orderBy: { createdAt: 'desc' },
        take: 15,
      }),
    ]);

    const { security, ...rest } = user;
    return {
      ...rest,
      hasPin: !!security?.pinHash,
      pinLockedUntil: security?.pinLockedUntil ?? null,
      orders,
      transactions: entries.map((e) => this.mapEntry(e)),
    };
  }

  // -----------------------------------------------------------------
  // Transactions (ledger) — global view
  // -----------------------------------------------------------------
  async listTransactions(q: {
    direction?: string;
    source?: string;
    reason?: string;
    userId?: string;
    search?: string;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
  }) {
    const where: Prisma.LedgerEntryWhereInput = {};
    if (q.direction) where.direction = q.direction as LedgerDirection;
    if (q.source) where.source = q.source;
    if (q.reason) where.reason = q.reason as LedgerReason;
    if (q.userId) where.walletAccount = { is: { ownerId: q.userId } };
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
        {
          walletAccount: {
            is: {
              user: {
                is: {
                  OR: [
                    { email: { contains: q.search, mode: 'insensitive' } },
                    { fullName: { contains: q.search, mode: 'insensitive' } },
                    { phone: { contains: q.search, mode: 'insensitive' } },
                  ],
                },
              },
            },
          },
        },
      ];
    }

    const { skip, take } = paginate(q.page, q.pageSize);
    const [total, rows] = await Promise.all([
      this.prisma.ledgerEntry.count({ where }),
      this.prisma.ledgerEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          walletAccount: {
            include: { user: { select: { id: true, email: true, fullName: true, phone: true } } },
          },
        },
      }),
    ]);
    return { total, page: q.page ?? 1, pageSize: take, items: rows.map((e) => this.mapEntry(e)) };
  }

  async getTransaction(id: string) {
    const entry = await this.prisma.ledgerEntry.findUnique({
      where: { id },
      include: {
        walletAccount: {
          include: { user: { select: { id: true, email: true, fullName: true, phone: true } } },
        },
      },
    });
    if (!entry) throw new NotFoundException('Transaction not found');

    let relatedOrder: unknown = null;
    if (entry.referenceType === 'Order' && entry.referenceId) {
      relatedOrder = await this.prisma.order.findUnique({ where: { id: entry.referenceId } });
    }

    return { ...this.mapEntry(entry), relatedOrder };
  }

  // -----------------------------------------------------------------
  // Wallets
  // -----------------------------------------------------------------
  async listWallets(q: { search?: string; status?: string; page?: number; pageSize?: number }) {
    const where: Prisma.WalletAccountWhereInput = {};
    if (q.status) where.status = q.status as WalletStatus;
    if (q.search) {
      where.user = {
        is: {
          OR: [
            { email: { contains: q.search, mode: 'insensitive' } },
            { fullName: { contains: q.search, mode: 'insensitive' } },
            { phone: { contains: q.search, mode: 'insensitive' } },
          ],
        },
      };
    }
    const { skip, take } = paginate(q.page, q.pageSize);
    const [total, rows] = await Promise.all([
      this.prisma.walletAccount.count({ where }),
      this.prisma.walletAccount.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
        include: { user: { select: { id: true, email: true, fullName: true, phone: true, status: true } } },
      }),
    ]);
    return { total, page: q.page ?? 1, pageSize: take, items: rows };
  }

  async getWallet(id: string) {
    const wallet = await this.prisma.walletAccount.findUnique({
      where: { id },
      include: { user: { select: { id: true, email: true, fullName: true, phone: true, status: true } } },
    });
    if (!wallet) throw new NotFoundException('Wallet not found');
    const entries = await this.prisma.ledgerEntry.findMany({
      where: { walletAccountId: id },
      orderBy: { createdAt: 'desc' },
      take: 25,
    });
    return { ...wallet, transactions: entries.map((e) => this.mapEntry(e)) };
  }

  async setWalletStatus(
    walletId: string,
    status: WalletStatus,
    actor: { adminId: string; ipAddress?: string; userAgent?: string },
    reason: string,
  ) {
    if (!reason || reason.trim().length < 5) {
      throw new BadRequestException('A written reason of at least 5 characters is required');
    }
    const wallet = await this.prisma.walletAccount.findUnique({ where: { id: walletId } });
    if (!wallet) throw new NotFoundException('Wallet not found');

    const updated = await this.prisma.walletAccount.update({
      where: { id: walletId },
      data: { status },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: actor.adminId,
        action: AuditAction.ADMIN_ACTION,
        entityType: 'WalletAccount',
        entityId: walletId,
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        reason,
        before: { status: wallet.status },
        after: { status },
        metadata: { action: 'wallet.set_status', ownerId: wallet.ownerId },
      },
    });
    return updated;
  }

  // -----------------------------------------------------------------
  // Orders
  // -----------------------------------------------------------------
  async listOrders(q: {
    search?: string;
    type?: string;
    status?: string;
    userId?: string;
    page?: number;
    pageSize?: number;
  }) {
    const where: Prisma.OrderWhereInput = {};
    if (q.type) where.type = q.type as never;
    if (q.status) where.status = q.status as OrderStatus;
    if (q.userId) where.userId = q.userId;
    if (q.search) {
      where.OR = [
        { phoneNumber: { contains: q.search, mode: 'insensitive' } },
        { id: { contains: q.search, mode: 'insensitive' } },
        {
          user: {
            is: {
              OR: [
                { email: { contains: q.search, mode: 'insensitive' } },
                { fullName: { contains: q.search, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];
    }
    const { skip, take } = paginate(q.page, q.pageSize);
    const [total, rows] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          user: { select: { id: true, email: true, fullName: true, phone: true } },
          vtuTransaction: { select: { id: true, status: true, provider: true, providerReference: true } },
        },
      }),
    ]);
    return { total, page: q.page ?? 1, pageSize: take, items: rows };
  }

  async listDisputes(q: { status?: string; search?: string; page?: number; pageSize?: number }) {
    const { skip, take } = paginate(q.page, q.pageSize);
    const status = q.status ?? null;
    const search = q.search ? `%${q.search}%` : null;
    const [countRows, items] = await Promise.all([
      this.prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
        SELECT COUNT(*)::bigint AS count FROM "TransactionDispute" d
        INNER JOIN "User" u ON u."id" = d."userId"
        WHERE (${status}::text IS NULL OR d."status"::text = ${status})
          AND (${search}::text IS NULL OR d."caseReference" ILIKE ${search} OR d."reason" ILIKE ${search} OR u."email" ILIKE ${search} OR u."fullName" ILIKE ${search})
      `),
      this.prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
        SELECT d.*, u."fullName" AS "userName", u."email" AS "userEmail", u."phone" AS "userPhone",
          l."amount", l."direction", l."reason" AS "ledgerReason", l."referenceId", l."createdAt" AS "transactionCreatedAt"
        FROM "TransactionDispute" d
        INNER JOIN "User" u ON u."id" = d."userId"
        INNER JOIN "LedgerEntry" l ON l."id" = d."ledgerEntryId"
        WHERE (${status}::text IS NULL OR d."status"::text = ${status})
          AND (${search}::text IS NULL OR d."caseReference" ILIKE ${search} OR d."reason" ILIKE ${search} OR u."email" ILIKE ${search} OR u."fullName" ILIKE ${search})
        ORDER BY d."createdAt" DESC OFFSET ${skip} LIMIT ${take}
      `),
    ]);
    return { total: Number(countRows[0]?.count ?? 0), page: q.page ?? 1, pageSize: take, items };
  }

  async updateDispute(
    id: string,
    status: string,
    actor: { adminId: string; ipAddress?: string; userAgent?: string },
    reason: string,
  ) {
    const allowed = ['OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED', 'CLOSED'];
    if (!allowed.includes(status)) throw new NotFoundException('Invalid dispute status');
    const existing = await this.prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`SELECT * FROM "TransactionDispute" WHERE "id" = ${id} LIMIT 1`);
    if (!existing[0]) throw new NotFoundException('Dispute not found');
    if (String(existing[0].status) === 'REFUND_PENDING') {
      throw new ConflictException('This dispute refund is being processed');
    }
    const resolvedAt = ['RESOLVED', 'REJECTED', 'CLOSED'].includes(status) ? new Date() : null;
    const updated = await this.prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
      UPDATE "TransactionDispute" SET "status" = ${status}::"DisputeStatus", "resolvedAt" = ${resolvedAt}, "updatedAt" = NOW()
      WHERE "id" = ${id}
        AND "status" = ${String(existing[0].status)}::"DisputeStatus"
        AND "refundEntryId" IS NULL
      RETURNING *
    `);
    if (!updated[0]) throw new ConflictException('This dispute was changed by another admin');
    await this.prisma.auditLog.create({
      data: {
        actorId: actor.adminId,
        action: AuditAction.ADMIN_ACTION,
        entityType: 'TransactionDispute',
        entityId: id,
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        reason,
        before: { status: String(existing[0].status ?? '') },
        after: { status },
        metadata: { action: 'dispute.set_status', caseReference: String(existing[0].caseReference ?? '') },
      },
    });
    const userId = String(existing[0].userId ?? '');
    const caseReference = String(existing[0].caseReference ?? '');
    if (userId && String(existing[0].status ?? '') !== status) {
      const labels: Record<string, string> = {
        IN_REVIEW: 'is now under review',
        RESOLVED: 'has been resolved',
        REJECTED: 'could not be approved',
        CLOSED: 'has been closed',
      };
      await this.notifications
        .create({
          userId,
          category: 'system',
          title: 'Dispute status updated',
          body: `Your dispute ${caseReference} ${labels[status] ?? 'was updated'}.`,
          metadata: { disputeId: id, caseReference, status },
        })
        .catch(() => undefined);
    }
    return updated[0];
  }

  // -----------------------------------------------------------------
  // Audit log
  // -----------------------------------------------------------------
  async listAudit(q: { action?: string; entityType?: string; actorId?: string; page?: number; pageSize?: number }) {
    const where: Prisma.AuditLogWhereInput = {};
    if (q.action) where.action = q.action as AuditAction;
    if (q.entityType) where.entityType = q.entityType;
    if (q.actorId) where.actorId = q.actorId;
    const { skip, take } = paginate(q.page, q.pageSize);
    const [total, rows] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: { actor: { select: { id: true, email: true, fullName: true, role: true } } },
      }),
    ]);
    return { total, page: q.page ?? 1, pageSize: take, items: rows };
  }

  // -----------------------------------------------------------------
  // Settings
  // -----------------------------------------------------------------
  async getSettings() {
    const auto = await this.credits.getAutoTestCreditSettings();
    return {
      fulfillmentMode: this.config.fulfillmentMode,
      providers: this.providerStatus(),
      autoTestCredit: { enabled: auto.enabled, amount: auto.amount },
      mailProvider: this.config.mailProvider,
      adminWebOrigin: this.config.adminWebOrigin,
    };
  }

  async updateSettings(
    dto: { autoTestCreditEnabled?: boolean; autoTestCreditAmount?: number },
    adminId: string,
    ipAddress?: string,
  ) {
    if (dto.autoTestCreditEnabled !== undefined) {
      await this.credits.setSetting('auto_test_credit_enabled', String(dto.autoTestCreditEnabled), adminId);
    }
    if (dto.autoTestCreditAmount !== undefined) {
      await this.credits.setSetting('auto_test_credit_amount', String(dto.autoTestCreditAmount), adminId);
    }
    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: AuditAction.ADMIN_ACTION,
        entityType: 'SystemSetting',
        entityId: 'settings',
        ipAddress,
        metadata: { ...dto },
      },
    });
    return this.getSettings();
  }

  // -----------------------------------------------------------------
  // Test credit
  // -----------------------------------------------------------------
  creditTestFunds(
    userId: string,
    amount: number,
    adminId: string,
    ipAddress?: string,
    idempotencyKey?: string,
  ) {
    return this.credits.grantTestCredit(userId, amount, {
      adminId,
      ipAddress,
      idempotencyKey,
      source: 'test_allocation',
      mode: 'test',
    });
  }

  // -----------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------
  private mapEntry(entry: {
    id: string;
    createdAt: Date;
    direction: LedgerDirection;
    amount: Prisma.Decimal;
    balanceAfter: Prisma.Decimal;
    reason: LedgerReason;
    narrative: string | null;
    source: string | null;
    mode: string | null;
    adminId: string | null;
    referenceType: string | null;
    referenceId: string | null;
    walletAccount?: {
      id: string;
      currency: string;
      user: { id: string; email: string; fullName: string; phone?: string | null } | null;
    } | null;
  }) {
    return {
      id: entry.id,
      createdAt: entry.createdAt,
      direction: entry.direction,
      amount: entry.amount.toString(),
      balanceAfter: entry.balanceAfter.toString(),
      reason: entry.reason,
      narrative: entry.narrative,
      source: entry.source,
      mode: entry.mode,
      adminId: entry.adminId,
      referenceType: entry.referenceType,
      referenceId: entry.referenceId,
      walletId: entry.walletAccount?.id ?? null,
      currency: entry.walletAccount?.currency ?? 'NGN',
      user: entry.walletAccount?.user ?? null,
    };
  }
}
