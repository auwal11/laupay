import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  AuditAction,
  LedgerDirection,
  LedgerReason,
  OrderStatus,
  Prisma,
  UserStatus,
  WalletStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppConfigService } from '../../config/app-config.service';
import { CreditsService } from '../credits/credits.service';

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
  ) {}

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
    ]);

    const ordersByStatus = Object.fromEntries(
      orderStatusGroups.map((g) => [g.status, g._count._all]),
    );

    return {
      fulfillmentMode: this.config.fulfillmentMode,
      users: { total: userCount, active: activeUserCount },
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
      recentUsers,
      recentTransactions: recentEntries.map((e) => this.mapEntry(e)),
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

  async setWalletStatus(walletId: string, status: WalletStatus, adminId: string, ipAddress?: string) {
    const wallet = await this.prisma.walletAccount.findUnique({ where: { id: walletId } });
    if (!wallet) throw new NotFoundException('Wallet not found');

    const updated = await this.prisma.walletAccount.update({
      where: { id: walletId },
      data: { status },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: AuditAction.ADMIN_ACTION,
        entityType: 'WalletAccount',
        entityId: walletId,
        ipAddress,
        metadata: { from: wallet.status, to: status, ownerId: wallet.ownerId },
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
