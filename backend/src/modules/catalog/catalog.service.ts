import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { VTU_PROVIDER, VTUProvider } from '../vtu/providers/vtu-provider.interface';
import { AppConfigService } from '../../config/app-config.service';

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(VTU_PROVIDER) private readonly provider: VTUProvider,
    private readonly config: AppConfigService,
  ) {}

  async listNetworks() {
    const networks = await this.prisma.network.findMany({
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
    });
    // Network identifiers are stable public catalog metadata. Returning the
    // supported list keeps the purchase selector usable if a fresh deployment
    // has not yet been seeded; prices and data plans still remain DB-backed.
    const publicNetworks = networks.length > 0 ? networks : [
      { id: 'MTN', code: 'MTN', name: 'MTN' },
      { id: 'AIRTEL', code: 'AIRTEL', name: 'Airtel' },
      { id: 'GLO', code: 'GLO', name: 'Glo' },
      { id: '9MOBILE', code: '9MOBILE', name: '9mobile' },
    ];
    return publicNetworks.map(({ id, code, name }) => ({ id, code, name }));
  }

  async listDataPlans(networkCode: string) {
    const network = await this.prisma.network.upsert({
      where: { code: networkCode.toUpperCase() },
      update: {},
      create: { code: networkCode.toUpperCase(), name: networkCode },
    });
    const providerPlans = await this.provider.listDataPlans(network.code);
    if (providerPlans.length === 0) return [];

    await Promise.all(providerPlans.map((plan) => {
      const id = `${this.config.vtuProvider}:${network.code}:${plan.externalCode}`;
      return this.prisma.dataPlan.upsert({
        where: { id },
        create: {
          id,
          networkId: network.id,
          externalCode: plan.externalCode,
          label: plan.label,
          priceNaira: plan.costNaira,
          costNaira: plan.costNaira,
          validityDays: plan.validityDays,
          isActive: true,
        },
        update: {
          label: plan.label,
          priceNaira: plan.costNaira,
          costNaira: plan.costNaira,
          validityDays: plan.validityDays,
          isActive: true,
        },
      });
    }));

    return this.prisma.dataPlan.findMany({
      where: { isActive: true, networkId: network.id, id: { startsWith: `${this.config.vtuProvider}:` } },
      select: { id: true, networkId: true, label: true, priceNaira: true, validityDays: true },
      orderBy: { priceNaira: 'asc' },
    }).then((plans) => plans.map(({ id, networkId, label, priceNaira, validityDays }) => ({
      id,
      networkId,
      label,
      priceNaira,
      validityDays,
    })));
  }
}
