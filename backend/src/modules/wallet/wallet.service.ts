import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Read-only. WalletService NEVER mutates a balance — all mutations go
 * through LedgerService. See docs/architecture/wallet-ledger-model.md.
 */
@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyWallet(userId: string) {
    const wallet = await this.prisma.walletAccount.findUnique({ where: { ownerId: userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');
    return wallet;
  }

  async getMyTransactions(userId: string, take = 50) {
    const wallet = await this.getMyWallet(userId);
    const entries = await this.prisma.ledgerEntry.findMany({
      where: { walletAccountId: wallet.id },
      orderBy: { createdAt: 'desc' },
      take,
    });
    return this.mapEntries(entries);
  }

  async getMyTransaction(userId: string, id: string) {
    const wallet = await this.getMyWallet(userId);
    const entry = await this.prisma.ledgerEntry.findFirst({ where: { id, walletAccountId: wallet.id } });
    if (!entry) throw new NotFoundException('Transaction not found');
    const mapped = await this.mapEntries([entry]);
    return mapped[0];
  }

  private async mapEntries(entries: Array<any>) {
    const orderIds = entries.filter((entry) => entry.referenceType === 'Order' && entry.referenceId).map((entry) => entry.referenceId);
    const orders = orderIds.length
      ? await this.prisma.order.findMany({ where: { id: { in: orderIds } }, select: { id: true, type: true, status: true, network: true, phoneNumber: true } })
      : [];
    const byId = new Map(orders.map((order) => [order.id, order]));
    return entries.map((entry) => {
      const order = entry.referenceId ? byId.get(entry.referenceId) : undefined;
      const amount = new Prisma.Decimal(entry.amount);
      const balanceAfter = new Prisma.Decimal(entry.balanceAfter);
      const balanceBefore = entry.direction === 'CREDIT' ? balanceAfter.minus(amount) : balanceAfter.plus(amount);
      return {
        ...entry,
        amount: String(entry.amount),
        balanceBefore: balanceBefore.toFixed(2),
        balanceAfter: balanceAfter.toFixed(2),
        direction: entry.direction.toLowerCase(),
        description: order ? `${order.type === 'AIRTIME' ? 'Airtime' : 'Data'} purchase` : entry.reason === 'WALLET_FUNDING' ? 'Wallet funding' : entry.reason === 'REVERSAL' || entry.reason === 'ORDER_REFUND' ? 'Wallet reversal' : entry.direction === 'CREDIT' ? 'Wallet credit' : 'Wallet debit',
        status: order ? mapOrderStatus(order.status) : 'success',
        network: order?.network ?? undefined,
        counterparty: order?.phoneNumber ?? undefined,
        orderType: order?.type?.toLowerCase() ?? undefined,
      };
    });
  }

  /**
   * Object-level ownership check (IDOR/BOLA prevention) — used by any
   * endpoint that accepts a walletAccountId and must verify the requester
   * actually owns it, rather than trusting the ID alone.
   * See docs/security/security-model.md §2.
   */
  async assertOwnership(walletAccountId: string, requesterUserId: string): Promise<void> {
    const wallet = await this.prisma.walletAccount.findUnique({
      where: { id: walletAccountId },
    });
    if (!wallet) throw new NotFoundException('Wallet not found');
    if (wallet.ownerId !== requesterUserId) {
      throw new ForbiddenException('You do not have access to this wallet');
    }
  }
}

function mapOrderStatus(status: OrderStatus): string {
  switch (status) {
    case OrderStatus.FULFILLED: return 'success';
    case OrderStatus.FULFILLMENT_FAILED:
    case OrderStatus.REFUNDED:
    case OrderStatus.CANCELLED: return 'failed';
    case OrderStatus.FULFILLMENT_UNKNOWN: return 'unknown';
    case OrderStatus.FULFILLING:
    case OrderStatus.PAID: return 'processing';
    default: return 'pending';
  }
}
