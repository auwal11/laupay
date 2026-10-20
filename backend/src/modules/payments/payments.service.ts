import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { LedgerReason, PaymentMethod, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppConfigService } from '../../config/app-config.service';
import { LedgerService } from '../ledger/ledger.service';
import { PAYMENT_PROVIDER, PaymentProvider } from './providers/payment-provider.interface';
import { SettingsService } from '../settings/settings.service';
import { RiskService } from '../risk/risk.service';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly config: AppConfigService,
    private readonly settings: SettingsService,
    private readonly risk: RiskService,
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

    // Operational kill switch + account/wallet/risk gate. A paused funding
    // service (or a frozen account) must fail before any provider call.
    await this.settings.assertServiceEnabled('wallet_funding', 'Wallet funding');
    await this.risk.assertCanTransact({ userId, kind: 'wallet_funding', amount });

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
        // Record the provider that actually handled this payment. Previously
        // hardcoded to 'mock', which mislabelled real Paystack/Monnify sandbox
        // payments in the ledger/audit trail.
        providerName: await this.settings.effectivePaymentProvider(),
      },
    });

    if (updated.status === PaymentStatus.SUCCESS) {
      await this.creditWalletForPayment(updated.id, userId, amount);
    }

    // Surface the provider-hosted checkout URL (Paystack/Monnify sandbox) so
    // the client can complete the payment. Never persisted in our DB and never
    // derived from client input — it comes straight from the provider.
    const checkoutUrl = this.extractCheckoutUrl(providerResult.raw);
    return checkoutUrl ? { ...updated, checkoutUrl } : updated;
  }

  /** Best-effort extraction of the provider-hosted checkout URL from a raw provider payload. */
  private extractCheckoutUrl(raw: unknown): string | undefined {
    if (raw && typeof raw === 'object' && 'checkoutUrl' in raw) {
      const candidate = (raw as { checkoutUrl?: unknown }).checkoutUrl;
      if (typeof candidate === 'string' && candidate.length > 0) return candidate;
    }
    return undefined;
  }

  /**
   * Agent confirms cash physically received from a walk-in customer.
   * Debits the AGENT's own wallet (float model — ADR 0002, decided).
   *
   * SECURITY: the amount debited from the agent's float is always computed
   * server-side from the Order + configured agent pricing
   * (computeAgentDebitAmount) — never trusted from the request body. An
   * earlier version of this method accepted a client-supplied `amount`
   * parameter, which would have let a malicious or buggy client debit an
   * arbitrary amount from the agent's own wallet. Fixed as part of the
   * ADR 0002 pricing-configurability follow-up.
   */
  async confirmAgentCash(agentUserId: string, orderId: string) {
    const idempotencyKey = `agent-cash:${orderId}`;
    const existingPayment = await this.prisma.payment.findUnique({ where: { idempotencyKey } });
    if (existingPayment) return existingPayment;

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    const agentDebitAmount = await this.computeAgentDebitAmount(order);

    const payment = await this.prisma.payment.create({
      data: {
        orderId,
        userId: order.userId,
        method: PaymentMethod.AGENT_CASH,
        // The Payment records the cash actually collected from the
        // customer (the order's face-value price) — this can legitimately
        // differ from what's debited from the agent's float below, if an
        // agent discount is configured (that difference is the agent's
        // margin/incentive).
        amount: order.amount,
        status: PaymentStatus.SUCCESS,
        idempotencyKey,
      },
    });

    const agentWallet = await this.prisma.walletAccount.findUniqueOrThrow({
      where: { ownerId: agentUserId },
    });

    await this.ledger.debit({
      walletAccountId: agentWallet.id,
      amount: agentDebitAmount,
      reason: LedgerReason.AGENT_CASH_COLLECTION,
      referenceType: 'Payment',
      referenceId: payment.id,
      idempotencyKey: `ledger:${idempotencyKey}`,
    });

    return payment;
  }

  /**
   * Computes what an agent's float should actually be debited for a given
   * order — see docs/decisions/0002-agent-settlement-model.md "Pricing:
   * Configurable, Never Hardcoded".
   *
   * Resolution order:
   *   1. If the order is a DATA purchase and its DataPlan has an explicit
   *      agentPriceNaira configured, use that.
   *   2. Else if the order's Network has a non-zero agentDiscountPercent
   *      configured, apply it to the order's face-value amount.
   *   3. Else (nothing configured — the default, unchanged behavior),
   *      debit the agent at the same face value the customer was charged.
   *
   * No specific discount/price is hardcoded here — every number involved
   * comes from the database (Network/DataPlan rows), or the deliberate
   * zero-discount default when nothing has been configured yet.
   */
  private async computeAgentDebitAmount(order: { type: string; amount: any; network: string | null; dataPlanId: string | null }): Promise<number> {
    const faceValue = Number(order.amount);

    if (order.type === 'DATA' && order.dataPlanId) {
      const plan = await this.prisma.dataPlan.findUnique({ where: { id: order.dataPlanId } });
      if (plan?.agentPriceNaira != null) {
        return Number(plan.agentPriceNaira);
      }
    }

    if (order.network) {
      const network = await this.prisma.network.findUnique({ where: { code: order.network } });
      const discountPercent = network ? Number(network.agentDiscountPercent) : 0;
      if (discountPercent > 0) {
        return faceValue * (1 - discountPercent / 100);
      }
    }

    return faceValue;
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
