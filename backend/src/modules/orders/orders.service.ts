import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AuditAction, LedgerReason, OrderStatus, OrderType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { VtuService } from '../vtu/vtu.service';
import { SecurityService } from '../security/security.service';
import { InsufficientBalanceError } from '../ledger/ledger.errors';
import { AppConfigService } from '../../config/app-config.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SettingsService } from '../settings/settings.service';
import { RiskService } from '../risk/risk.service';

/** Orders that have already reached a terminal state — never re-touched by
 * async resolution once here (see reconcileVtuTransaction below). */
const TERMINAL_STATUSES: OrderStatus[] = [
  OrderStatus.FULFILLED,
  OrderStatus.REFUNDED,
  OrderStatus.CANCELLED,
];

/**
 * Machine-readable cancellation reason returned when an order is cancelled
 * because the wallet could not cover it. Clients render a dedicated
 * "insufficient funds" warning from this instead of a generic cancellation.
 */
const INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly vtu: VtuService,
    private readonly security: SecurityService,
    private readonly config: AppConfigService,
    private readonly notifications: NotificationsService,
    private readonly settings: SettingsService,
    private readonly risk: RiskService,
  ) {}

  /**
   * Airtime purchase, paid from the customer's wallet.
   * Flow: create order -> debit wallet (idempotent) -> fulfill via VTU.
   * See docs/architecture/vtu-flow.md §2 for why debit happens before
   * fulfillment, and how FAILED/UNKNOWN provider results are handled.
   */
  async createAirtimeOrder(
    userId: string,
    network: string,
    phoneNumber: string,
    amount: number,
    idempotencyKey: string,
    pin: string,
  ) {
    await this.security.verifyPin(userId, pin);
    const existing = await this.prisma.order.findUnique({ where: { idempotencyKey } });
    if (existing) return existing;

    await this.settings.assertServiceEnabled('airtime', 'Airtime purchases');
    await this.risk.assertCanTransact({ userId, kind: 'airtime', amount, phoneNumber });

    const order = await this.prisma.order.create({
      data: {
        userId,
        type: OrderType.AIRTIME,
        status: OrderStatus.CREATED,
        network,
        phoneNumber,
        amount,
        mode: this.config.fulfillmentMode,
        idempotencyKey,
      },
    });

    const debited = await this.debitForOrder(order.id, userId, amount);
    if (!debited) {
      return this.cancelledForInsufficientFunds(order.id);
    }

    await this.prisma.order.update({ where: { id: order.id }, data: { status: OrderStatus.PAID } });

    const vtuResult = await this.vtu.fulfillAirtimeOrder(order.id, network, phoneNumber, amount);
    const finalOrder = await this.applyVtuOutcome(order.id, vtuResult.status);
    // Placeholder risk decision — see SecurityService.assessOrderRisk docblock.
    // Not a real fraud engine; gives apps/customer-web a real response
    // shape to render instead of only mock data.
    return { ...finalOrder, riskDecision: this.security.assessOrderRisk().decision };
  }

  /**
   * Data purchase, paid from the customer's wallet. Mirrors
   * createAirtimeOrder's flow (debit -> fulfill -> reverse-on-failure) but
   * prices from a DataPlan snapshot rather than a client-supplied amount —
   * the customer cannot set their own price for a fixed data bundle.
   */
  async createDataOrder(
    userId: string,
    network: string,
    phoneNumber: string,
    dataPlanId: string,
    idempotencyKey: string,
    pin: string,
  ) {
    await this.security.verifyPin(userId, pin);
    const existing = await this.prisma.order.findUnique({ where: { idempotencyKey } });
    if (existing) return existing;

    const plan = await this.prisma.dataPlan.findUniqueOrThrow({ where: { id: dataPlanId } });
    if (!plan.isActive) {
      throw new ForbiddenException('This data plan is no longer available');
    }
    // Price is taken from the server-side catalog record, never from the
    // client — see docs/security/security-model.md §3.
    const amount = Number(plan.priceNaira);

    await this.settings.assertServiceEnabled('data', 'Data purchases');
    await this.risk.assertCanTransact({ userId, kind: 'data', amount, phoneNumber });

    const order = await this.prisma.order.create({
      data: {
        userId,
        type: OrderType.DATA,
        status: OrderStatus.CREATED,
        network,
        phoneNumber,
        dataPlanId,
        amount,
        mode: this.config.fulfillmentMode,
        idempotencyKey,
      },
    });

    const debited = await this.debitForOrder(order.id, userId, amount);
    if (!debited) {
      return this.cancelledForInsufficientFunds(order.id);
    }

    await this.prisma.order.update({ where: { id: order.id }, data: { status: OrderStatus.PAID } });

    const vtuResult = await this.vtu.fulfillDataOrder(order.id, network, phoneNumber, plan.externalCode);
    const finalOrder = await this.applyVtuOutcome(order.id, vtuResult.status);
    // Placeholder risk decision — see SecurityService.assessOrderRisk docblock.
    // Not a real fraud engine; gives apps/customer-web a real response
    // shape to render instead of only mock data.
    return { ...finalOrder, riskDecision: this.security.assessOrderRisk().decision };
  }

  /**
   * Resolves an order's outcome when its VTU transaction's status becomes
   * known ASYNCHRONOUSLY — i.e. via the VTU webhook (POST /webhooks/vtu) or
   * the scheduled reconciliation job — rather than during the original
   * synchronous request.
   *
   * This closes the gap identified in
   * docs/decisions/0003-phase1-hardening-review.md (Remaining Risk #2):
   * previously, an order that returned FULFILLMENT_UNKNOWN from its initial
   * request would never be revisited even after the provider later
   * confirmed success or failure, leaving money debited with no reversal
   * and no way for the order to ever reach a terminal state.
   *
   * Safe to call multiple times / concurrently with the synchronous path:
   * - Orders already in a terminal state (§TERMINAL_STATUSES) are left
   *   untouched.
   * - The underlying ledger reversal is idempotent
   *   (LedgerService.reverse -> applyEntry, keyed by
   *   `ledger:order:<id>:reversal`), so calling this twice for the same
   *   order never double-reverses.
   */
  async reconcileVtuTransaction(vtuTransactionId: string) {
    const txn = await this.vtu.requeryTransaction(vtuTransactionId);
    const order = await this.prisma.order.findUnique({ where: { id: txn.orderId } });
    if (!order) {
      this.logger.warn(`VtuTransaction ${vtuTransactionId} references missing order ${txn.orderId}`);
      return null;
    }

    if (TERMINAL_STATUSES.includes(order.status)) {
      return order; // already resolved by the synchronous path or a prior async pass
    }

    return this.applyVtuOutcome(order.id, txn.status);
  }

  async getOrder(orderId: string, requesterId: string, requesterRole: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    const isOwner = order.userId === requesterId || order.agentId === requesterId;
    const isPrivileged = requesterRole === 'ADMIN' || requesterRole === 'SUPPORT';
    if (!isOwner && !isPrivileged) {
      throw new ForbiddenException('You do not have access to this order');
    }
    return order;
  }

  async listMyOrders(userId: string) {
    return this.prisma.order.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }

  /**
   * Returned when debitForOrder found insufficient balance. The order is
   * already persisted as CANCELLED; we attach the machine-readable reason so
   * the client can render an "insufficient funds" warning rather than a
   * generic cancellation.
   */
  private async cancelledForInsufficientFunds(orderId: string) {
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    await this.createOrderNotification(order.userId, 'Purchase not completed', 'Your wallet balance was not enough for this purchase.', order.id, order.status);
    return { ...order, failureReason: INSUFFICIENT_FUNDS };
  }

  /**
   * Debits the customer's wallet for an order. Returns false (and leaves
   * the order CANCELLED) if the wallet had insufficient balance; the caller
   * must stop and return the (already-updated) order in that case rather
   * than proceeding to fulfillment.
   */
  private async debitForOrder(orderId: string, userId: string, amount: number): Promise<boolean> {
    const wallet = await this.prisma.walletAccount.findUniqueOrThrow({ where: { ownerId: userId } });
    try {
      await this.ledger.debit({
        walletAccountId: wallet.id,
        amount,
        reason: LedgerReason.ORDER_PAYMENT,
        referenceType: 'Order',
        referenceId: orderId,
        idempotencyKey: `ledger:order:${orderId}`,
      });
      return true;
    } catch (err) {
      if (err instanceof InsufficientBalanceError) {
        await this.prisma.order.update({ where: { id: orderId }, data: { status: OrderStatus.CANCELLED } });
        return false;
      }
      throw err;
    }
  }

  /**
   * Single place where a VTU status (from either the synchronous
   * fulfillment call or an async resolution) is translated into an Order
   * status update, reversing the original debit on FAILED. Shared by
   * createAirtimeOrder / createDataOrder / reconcileVtuTransaction so the
   * two code paths can never drift out of sync with each other.
   */
  private async applyVtuOutcome(orderId: string, vtuStatus: string) {
    const finalStatus = this.mapVtuStatusToOrderStatus(vtuStatus);

    if (finalStatus === OrderStatus.FULFILLMENT_FAILED) {
      // Reverse the debit — the customer was charged but the network never
      // delivered the airtime/data. See wallet-ledger-model.md §6.
      const ledgerIdempotencyKey = `ledger:order:${orderId}`;
      const originalEntry = await this.prisma.ledgerEntry.findUnique({
        where: { idempotencyKey: ledgerIdempotencyKey },
      });
      if (originalEntry) {
        await this.ledger.reverse(originalEntry.id, `${ledgerIdempotencyKey}:reversal`);
      } else {
        // Should not happen (an order only reaches fulfillment after a
        // successful debit), but never silently skip a status update if it
        // somehow does — log loudly rather than leaving the order stuck.
        this.logger.error(
          `Order ${orderId} resolved FULFILLMENT_FAILED but no original debit ledger entry was found — wallet was never reversed`,
        );
      }
      const updated = await this.prisma.order.update({ where: { id: orderId }, data: { status: OrderStatus.REFUNDED } });
      await this.createOrderNotification(updated.userId, 'Purchase failed', 'Your purchase could not be fulfilled and the debit was reversed.', updated.id, updated.status);
      return updated;
    }

    const updated = await this.prisma.order.update({ where: { id: orderId }, data: { status: finalStatus } });
    if (finalStatus === OrderStatus.FULFILLED) {
      await this.createOrderNotification(updated.userId, 'Purchase successful', 'Your digital service purchase was completed successfully.', updated.id, updated.status);
    }
    return updated;
  }

  private async createOrderNotification(userId: string, title: string, body: string, orderId: string, status: OrderStatus): Promise<void> {
    try {
      await this.notifications.create({ userId, category: 'order', title, body, metadata: { orderId, status } });
    } catch (error) {
      // Notification delivery must never turn an already-booked order into a
      // client-visible failure. The order/ledger remains authoritative.
      this.logger.warn(`Could not create notification for order ${orderId}: ${String(error)}`);
    }
  }


  // -----------------------------------------------------------------
  // Admin settlement / fulfilment control
  // -----------------------------------------------------------------

  async adminOrderDetail(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { id: true, email: true, fullName: true, phone: true, status: true } },
        dataPlan: { select: { id: true, label: true, externalCode: true, priceNaira: true } },
        vtuTransaction: true,
        payments: true,
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    const ledgerEntries = await this.prisma.ledgerEntry.findMany({
      where: { referenceType: 'Order', referenceId: orderId },
      orderBy: { createdAt: 'asc' },
    });
    return { ...order, ledgerEntries };
  }

  /** Re-query the provider for an unresolved order. Safe to call repeatedly. */
  async adminRetryFulfillment(orderId: string, adminId: string, ipAddress?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { vtuTransaction: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (TERMINAL_STATUSES.includes(order.status)) {
      throw new BadRequestException('This order is already final and cannot be retried');
    }
    if (!order.vtuTransaction) {
      throw new BadRequestException('This order has no provider transaction to re-query');
    }
    const resolved = await this.reconcileVtuTransaction(order.vtuTransaction.id);
    await this.audit(adminId, 'Order', orderId, ipAddress, 'order.retry', order.status, resolved?.status ?? order.status, 'Provider re-query requested by admin');
    return resolved;
  }

  /**
   * Manually marks an order successful (e.g. the provider delivered but the
   * callback was lost). Requires a written reason and is fully audited.
   */
  async adminMarkSuccessful(orderId: string, adminId: string, reason: string, ipAddress?: string) {
    if (!reason || reason.trim().length < 5) {
      throw new BadRequestException('A reason of at least 5 characters is required');
    }
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { vtuTransaction: true } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === OrderStatus.FULFILLED) return order;

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.FULFILLED,
        failureReason: null,
        settledBy: adminId,
        settledAt: new Date(),
      },
    });
    if (order.vtuTransaction) {
      await this.prisma.vtuTransaction.update({
        where: { id: order.vtuTransaction.id },
        data: { status: 'SUCCESS' },
      }).catch(() => undefined);
    }
    await this.createOrderNotification(updated.userId, 'Purchase successful', 'Your purchase was confirmed as completed successfully.', updated.id, updated.status);
    await this.audit(adminId, 'Order', orderId, ipAddress, 'order.mark_successful', order.status, updated.status, reason);
    return updated;
  }

  /**
   * Manually marks an order failed. If the wallet was already debited, the
   * debit is reversed through the ledger (never by editing balances directly).
   */
  async adminMarkFailed(orderId: string, adminId: string | null, reason: string, ipAddress?: string) {
    if (!reason || reason.trim().length < 5) {
      throw new BadRequestException('A reason of at least 5 characters is required');
    }
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { vtuTransaction: true } });
    if (!order) throw new NotFoundException('Order not found');
    if (TERMINAL_STATUSES.includes(order.status)) return order;

    return this.failOrder(order, adminId, reason, ipAddress, 'ADMIN_MANUAL');
  }

  /**
   * Background timeout resolution: any order left unresolved beyond the
   * configured window is re-queried once, then failed + refunded so a customer
   * can never be stuck on "Confirming" forever.
   */
  async resolveStaleOrders(timeoutMinutes: number): Promise<number> {
    if (!(timeoutMinutes > 0)) return 0;
    const cutoff = new Date(Date.now() - timeoutMinutes * 60_000);
    const stale = await this.prisma.order.findMany({
      where: {
        status: {
          in: [OrderStatus.CREATED, OrderStatus.PAID, OrderStatus.FULFILLING, OrderStatus.FULFILLMENT_UNKNOWN],
        },
        createdAt: { lt: cutoff },
      },
      take: 100,
      include: { vtuTransaction: true },
    });

    for (const order of stale) {
      try {
        if (order.vtuTransaction) {
          const resolved = await this.reconcileVtuTransaction(order.vtuTransaction.id);
          if (resolved && TERMINAL_STATUSES.includes(resolved.status)) continue;
          if (resolved && resolved.status === OrderStatus.FULFILLMENT_UNKNOWN) {
            // provider still has no definitive answer — fall through and settle
          }
        }
        const fresh = await this.prisma.order.findUnique({ where: { id: order.id } });
        if (fresh && !TERMINAL_STATUSES.includes(fresh.status)) {
          await this.failOrder(fresh, null, 'Order timed out without a provider outcome', undefined, 'TIMEOUT');
        }
      } catch (err) {
        this.logger.error(`Failed to resolve stale order ${order.id}: ${String(err)}`);
      }
    }
    return stale.length;
  }

  /** Shared failure path: reverse the debit (idempotently) and notify. */
  private async failOrder(
    order: { id: string; userId: string; status: OrderStatus; vtuTransaction?: { id: string } | null },
    adminId: string | null,
    reason: string,
    ipAddress: string | undefined,
    failureReason: string,
  ) {
    const ledgerIdempotencyKey = `ledger:order:${order.id}`;
    const originalEntry = await this.prisma.ledgerEntry.findUnique({
      where: { idempotencyKey: ledgerIdempotencyKey },
    });
    let reversed = false;
    if (originalEntry) {
      await this.ledger.reverse(originalEntry.id, `${ledgerIdempotencyKey}:reversal`);
      reversed = true;
    }

    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: reversed ? OrderStatus.REFUNDED : OrderStatus.FULFILLMENT_FAILED,
        failureReason,
        settledBy: adminId,
        settledAt: new Date(),
      },
    });

    if (order.vtuTransaction) {
      await this.prisma.vtuTransaction.update({
        where: { id: order.vtuTransaction.id },
        data: { status: 'FAILED' },
      }).catch(() => undefined);
    }

    await this.createOrderNotification(
      updated.userId,
      reversed ? 'Purchase failed — refunded' : 'Purchase failed',
      reversed
        ? 'Your purchase could not be completed. The amount debited has been returned to your wallet.'
        : 'Your purchase could not be completed.',
      updated.id,
      updated.status,
    );
    await this.audit(adminId, 'Order', order.id, ipAddress, 'order.mark_failed', order.status, updated.status, reason, {
      reversed,
    });
    return updated;
  }

  private async audit(
    actorId: string | null,
    entityType: string,
    entityId: string,
    ipAddress: string | undefined,
    action: string,
    before: string,
    after: string,
    reason: string,
    extra?: Record<string, unknown>,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: actorId ?? undefined,
          action: AuditAction.ADMIN_ACTION,
          entityType,
          entityId,
          ipAddress,
          reason,
          before: { status: before },
          after: { status: after },
          metadata: { action, ...(extra ?? {}) },
        },
      });
    } catch (err) {
      this.logger.warn(`Audit write failed for ${entityType} ${entityId}: ${String(err)}`);
    }
  }

  private mapVtuStatusToOrderStatus(vtuStatus: string): OrderStatus {
    switch (vtuStatus) {
      case 'SUCCESS':
        return OrderStatus.FULFILLED;
      case 'FAILED':
        return OrderStatus.FULFILLMENT_FAILED;
      case 'UNKNOWN':
        return OrderStatus.FULFILLMENT_UNKNOWN;
      default:
        return OrderStatus.FULFILLING;
    }
  }
}
