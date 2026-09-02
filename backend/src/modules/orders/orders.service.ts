import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { LedgerReason, OrderStatus, OrderType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { VtuService } from '../vtu/vtu.service';
import { InsufficientBalanceError } from '../ledger/ledger.errors';

@Injectable()
export class OrdersService {
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

    const wallet = await this.prisma.walletAccount.findUniqueOrThrow({
      where: { ownerId: userId },
    });

    try {
      await this.ledger.debit({
        walletAccountId: wallet.id,
        amount,
        reason: LedgerReason.ORDER_PAYMENT,
        referenceType: 'Order',
        referenceId: order.id,
        idempotencyKey: `ledger:order:${order.id}`,
      });
    } catch (err) {
      if (err instanceof InsufficientBalanceError) {
        await this.prisma.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.CANCELLED },
        });
      }
      throw err;
    }

    await this.prisma.order.update({ where: { id: order.id }, data: { status: OrderStatus.PAID } });

    const vtuResult = await this.vtu.fulfillAirtimeOrder(order.id, network, phoneNumber, amount);

    const finalStatus = this.mapVtuStatusToOrderStatus(vtuResult.status);
    const updatedOrder = await this.prisma.order.update({
      where: { id: order.id },
      data: { status: finalStatus },
    });

    if (finalStatus === OrderStatus.FULFILLMENT_FAILED) {
      // Reverse the debit — the customer was charged but the network never
      // delivered the airtime. See wallet-ledger-model.md §6.
      const originalEntry = await this.prisma.ledgerEntry.findUniqueOrThrow({
        where: { idempotencyKey: `ledger:order:${order.id}` },
      });
      await this.ledger.reverse(originalEntry.id, `ledger:order:${order.id}:reversal`);
      return this.prisma.order.update({ where: { id: order.id }, data: { status: OrderStatus.REFUNDED } });
    }

    return updatedOrder;
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
