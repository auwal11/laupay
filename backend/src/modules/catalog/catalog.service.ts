import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listNetworks() {
    const networks = await this.prisma.network.findMany({ orderBy: { code: 'asc' } });
    // Network identifiers are stable public catalog metadata. Returning the
    // supported list keeps the purchase selector usable if a fresh deployment
    // has not yet been seeded; prices and data plans still remain DB-backed.
    return networks.length > 0 ? networks : [
      { id: 'MTN', code: 'MTN', name: 'MTN' },
      { id: 'AIRTEL', code: 'AIRTEL', name: 'Airtel' },
      { id: 'GLO', code: 'GLO', name: 'Glo' },
      { id: '9MOBILE', code: '9MOBILE', name: '9mobile' },
    ];
  }

  listDataPlans(networkCode: string) {
    return this.prisma.dataPlan.findMany({
      where: { isActive: true, network: { code: networkCode } },
      orderBy: { priceNaira: 'asc' },
    });
  }
}
