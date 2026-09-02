import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { LedgerReason, PaymentMethod, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { PAYMENT_PROVIDER, PaymentProvider } from './providers/payment-provider.interface';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  /**
   * Customer-initiated wallet funding via a provider (mock or real).
   * The wallet is only ever credited once the provider (or, later, the
   * reconciliation job) reports SUCCESS — never optimistically on request.
   */
  async initializeWalletFunding(userId: string, amount: number, idempotencyKey: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const existingPayment = await this.prisma.payment.findUnique({ where: { idempotencyKey } });
    if (existingPayment) return existingPayment;

    const payment = await this.prisma.payment.create({
      data: {
        userId,
        method: PaymentMethod.PROVIDER_CARD,
        status: PaymentStatus.PENDING,
        amount,
        idempotencyKey,
      },
    });

    const providerResult = await this.provider.initialize({
      amount,
      currency: 'NGN',
      idempotencyKey,
      customerEmail: user.email,
    });

    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: this.mapProviderStatus(providerResult.status),
        providerReference: providerResult.providerReference,
        providerName: 'mock',
      },
    });

    if (updated.status === PaymentStatus.SUCCESS) {
      await this.creditWalletForPayment(updated.id, userId, amount);
    }

    return updated;
  }

  /**
   * Agent confirms cash physically received from a walk-in customer.
   * Debits the AGENT's own wallet (float model — see
   * docs/architecture/pos-agent-model.md §3, currently the default until
   * ADR 0002 is resolved).
   */
  async confirmAgentCash(agentUserId: string, orderId: string, amount: number) {
    const idempotencyKey = `agent-cash:${orderId}`;
    const existingPayment = await this.prisma.payment.findUnique({ where: { idempotencyKey } });
    if (existingPayment) return existingPayment;

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    const payment = await this.prisma.payment.create({
      data: {
        orderId,
        userId: order.userId,
        method: PaymentMethod.AGENT_CASH,
        status: PaymentStatus.SUCCESS,
        amount,
        idempotencyKey,
      },
    });

    const agentWallet = await this.prisma.walletAccount.findUniqueOrThrow({
      where: { ownerId: agentUserId },
    });

    await this.ledger.debit({
      walletAccountId: agentWallet.id,
      amount,
      reason: LedgerReason.AGENT_CASH_COLLECTION,
      referenceType: 'Payment',
      referenceId: payment.id,
      idempotencyKey: `ledger:${idempotencyKey}`,
    });

    return payment;
  }

  /** Requery a stuck PROCESSING/UNKNOWN payment. Used by the (not-yet-scheduled) reconciliation job. */
  async requeryPayment(paymentId: string) {
    const payment = await this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    if (!payment.providerReference) return payment;

    const providerResult = await this.provider.verifyTransaction(payment.providerReference);
    const newStatus = this.mapProviderStatus(providerResult.status);

    if (newStatus === payment.status) return payment;

    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: newStatus },
    });

    if (newStatus === PaymentStatus.SUCCESS) {
      await this.creditWalletForPayment(updated.id, updated.userId, Number(updated.amount));
    }

    return updated;
  }

  private async creditWalletForPayment(paymentId: string, userId: string, amount: number) {
    const wallet = await this.prisma.walletAccount.findUniqueOrThrow({ where: { ownerId: userId } });
    await this.ledger.credit({
      walletAccountId: wallet.id,
      amount,
      reason: LedgerReason.WALLET_FUNDING,
      referenceType: 'Payment',
      referenceId: paymentId,
      idempotencyKey: `ledger:payment:${paymentId}`,
    });
  }

  private mapProviderStatus(status: string): PaymentStatus {
    switch (status) {
      case 'SUCCESS':
        return PaymentStatus.SUCCESS;
      case 'FAILED':
        return PaymentStatus.FAILED;
      case 'PROCESSING':
        return PaymentStatus.PROCESSING;
      case 'UNKNOWN':
        return PaymentStatus.UNKNOWN;
      default:
        return PaymentStatus.PENDING;
    }
  }
}
