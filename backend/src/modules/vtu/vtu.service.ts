import { Inject, Injectable } from '@nestjs/common';
import { VtuProviderName, VtuTransactionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { VTU_PROVIDER, VTUProvider } from './providers/vtu-provider.interface';

@Injectable()
export class VtuService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(VTU_PROVIDER) private readonly provider: VTUProvider,
  ) {}

  /**
   * Fulfills an already-PAID order via the VTU provider. Called by
   * OrdersService only after the wallet debit has succeeded — see
   * docs/architecture/vtu-flow.md §2 for why debit happens first.
   */
  async fulfillAirtimeOrder(orderId: string, network: string, phoneNumber: string, amount: number) {
    const idempotencyKey = `vtu:${orderId}`;
    const existing = await this.prisma.vtuTransaction.findUnique({ where: { idempotencyKey } });
    if (existing) return existing;

    const txn = await this.prisma.vtuTransaction.create({
      data: {
        orderId,
        provider: VtuProviderName.MOCK,
        status: VtuTransactionStatus.PROCESSING,
        idempotencyKey,
      },
    });

    const result = await this.provider.purchaseAirtime({
      network,
      phoneNumber,
      amount,
      idempotencyKey,
    });

    return this.prisma.vtuTransaction.update({
      where: { id: txn.id },
      data: {
        status: this.mapStatus(result.status),
        providerReference: result.providerReference,
      },
    });
  }

  async requeryTransaction(vtuTransactionId: string) {
    const txn = await this.prisma.vtuTransaction.findUniqueOrThrow({
      where: { id: vtuTransactionId },
    });
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
