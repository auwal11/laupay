import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  listNetworks() {
    return this.prisma.network.findMany();
  }

  listDataPlans(networkCode: string) {
    return this.prisma.dataPlan.findMany({
      where: { isActive: true, network: { code: networkCode } },
      orderBy: { priceNaira: 'asc' },
    });
  }
}
