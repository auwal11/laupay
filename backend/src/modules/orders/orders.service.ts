import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { LedgerReason, OrderStatus, OrderType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { VtuService } from '../vtu/vtu.service';
import { InsufficientBalanceError } from '../ledger/ledger.errors';

/** Orders that have already reached a terminal state — never re-touched by
 * async resolution once here (see reconcileVtuTransaction below). */
const TERMINAL_STATUSES: OrderStatus[] = [
  OrderStatus.FULFILLED,
  OrderStatus.REFUNDED,
  OrderStatus.CANCELLED,
];

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly vtu: VtuService,
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
  ) {
    const existing = await this.prisma.order.findUnique({ where: { idempotencyKey } });
    if (existing) return existing;

    const order = await this.prisma.order.create({
      data: {
        userId,
        type: OrderType.AIRTIME,
        status: OrderStatus.CREATED,
        network,
        phoneNumber,
        amount,
        idempotencyKey,
      },
    });

    const debited = await this.debitForOrder(order.id, userId, amount);
    if (!debited) return this.prisma.order.findUniqueOrThrow({ where: { id: order.id } });

    await this.prisma.order.update({ where: { id: order.id }, data: { status: OrderStatus.PAID } });

    const vtuResult = await this.vtu.fulfillAirtimeOrder(order.id, network, phoneNumber, amount);
    return this.applyVtuOutcome(order.id, vtuResult.status);
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
  ) {
    const existing = await this.prisma.order.findUnique({ where: { idempotencyKey } });
    if (existing) return existing;

    const plan = await this.prisma.dataPlan.findUniqueOrThrow({ where: { id: dataPlanId } });
    if (!plan.isActive) {
      throw new ForbiddenException('This data plan is no longer available');
    }
    // Price is taken from the server-side catalog record, never from the
    // client — see docs/security/security-model.md §3.
    const amount = Number(plan.priceNaira);

    const order = await this.prisma.order.create({
      data: {
        userId,
        type: OrderType.DATA,
        status: OrderStatus.CREATED,
        network,
        phoneNumber,
        dataPlanId,
        amount,
        idempotencyKey,
      },
    });

    const debited = await this.debitForOrder(order.id, userId, amount);
    if (!debited) return this.prisma.order.findUniqueOrThrow({ where: { id: order.id } });

    await this.prisma.order.update({ where: { id: order.id }, data: { status: OrderStatus.PAID } });

    const vtuResult = await this.vtu.fulfillDataOrder(order.id, network, phoneNumber, plan.externalCode);
    return this.applyVtuOutcome(order.id, vtuResult.status);
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
      return this.prisma.order.update({ where: { id: orderId }, data: { status: OrderStatus.REFUNDED } });
    }

    return this.prisma.order.update({ where: { id: orderId }, data: { status: finalStatus } });
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
