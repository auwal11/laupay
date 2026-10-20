import { Inject, Injectable } from '@nestjs/common';
import { VtuProviderName, VtuTransactionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { VTU_PROVIDER, VTUProvider } from './providers/vtu-provider.interface';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class VtuService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(VTU_PROVIDER) private readonly provider: VTUProvider,
    private readonly settings: SettingsService,
  ) {}

  /** Provider label recorded on the VTU transaction, derived from the mode. */
  private providerName(mode: string): VtuProviderName {
    switch (mode) {
      case 'live':
        return VtuProviderName.VTPASS_LIVE;
      case 'provider_test':
        return VtuProviderName.VTPASS_SANDBOX;
      default:
        return VtuProviderName.MOCK;
    }
  }

  /**
   * Fulfills an already-PAID order via the VTU provider. Called by
   * OrdersService only after the wallet debit has succeeded — see
   * docs/architecture/vtu-flow.md §2 for why debit happens first.
   *
   * In FULFILLMENT_MODE=simulated the wallet is still debited and the order
   * is marked SUCCESS, but no real airtime/data is sent to any provider.
   */
  async fulfillAirtimeOrder(orderId: string, network: string, phoneNumber: string, amount: number) {
    const idempotencyKey = `vtu:${orderId}`;
    const existing = await this.prisma.vtuTransaction.findUnique({ where: { idempotencyKey } });
    if (existing) return existing;

    const mode = await this.settings.effectiveFulfillmentMode();
    const txn = await this.prisma.vtuTransaction.create({
      data: {
        orderId,
        provider: this.providerName(mode),
        status: VtuTransactionStatus.PROCESSING,
        idempotencyKey,
      },
    });

    if (mode === 'simulated') {
      return this.prisma.vtuTransaction.update({
        where: { id: txn.id },
        data: {
          status: VtuTransactionStatus.SUCCESS,
          providerReference: `sim-${orderId}`,
          rawResponse: { simulated: true, kind: 'airtime', network, phoneNumber, amount },
        },
      });
    }

    const result = await this.provider.purchaseAirtime({ network, phoneNumber, amount, idempotencyKey });
    return this.prisma.vtuTransaction.update({
      where: { id: txn.id },
      data: {
        status: this.mapStatus(result.status),
        providerReference: result.providerReference,
        rawResponse: (result.raw as object | undefined) ?? undefined,
      },
    });
  }

  async fulfillDataOrder(orderId: string, network: string, phoneNumber: string, planCode: string) {
    const idempotencyKey = `vtu:${orderId}`;
    const existing = await this.prisma.vtuTransaction.findUnique({ where: { idempotencyKey } });
    if (existing) return existing;

    const mode = await this.settings.effectiveFulfillmentMode();
    const txn = await this.prisma.vtuTransaction.create({
      data: {
        orderId,
        provider: this.providerName(mode),
        status: VtuTransactionStatus.PROCESSING,
        idempotencyKey,
      },
    });

    if (mode === 'simulated') {
      return this.prisma.vtuTransaction.update({
        where: { id: txn.id },
        data: {
          status: VtuTransactionStatus.SUCCESS,
          providerReference: `sim-${orderId}`,
          rawResponse: { simulated: true, kind: 'data', network, phoneNumber, planCode },
        },
      });
    }

    const result = await this.provider.purchaseData({ network, phoneNumber, planCode, idempotencyKey });
    return this.prisma.vtuTransaction.update({
      where: { id: txn.id },
      data: {
        status: this.mapStatus(result.status),
        providerReference: result.providerReference,
        rawResponse: (result.raw as object | undefined) ?? undefined,
      },
    });
  }

  async requeryTransaction(vtuTransactionId: string) {
    const txn = await this.prisma.vtuTransaction.findUniqueOrThrow({
      where: { id: vtuTransactionId },
    });
    // Simulated transactions are terminal by construction — never requery a
    // real provider for something that never touched one.
    if (txn.providerReference?.startsWith('sim-')) return txn;
    if (!txn.providerReference) return txn;

    const result = await this.provider.verifyTransaction(txn.providerReference);
    const newStatus = this.mapStatus(result.status);
    if (newStatus === txn.status) return txn;

    return this.prisma.vtuTransaction.update({
      where: { id: txn.id },
      data: { status: newStatus },
    });
  }

  private mapStatus(status: string): VtuTransactionStatus {
    switch (status) {
      case 'SUCCESS':
        return VtuTransactionStatus.SUCCESS;
      case 'FAILED':
        return VtuTransactionStatus.FAILED;
      case 'PROCESSING':
        return VtuTransactionStatus.PROCESSING;
      case 'UNKNOWN':
        return VtuTransactionStatus.UNKNOWN;
      default:
        return VtuTransactionStatus.PENDING;
    }
  }
}
