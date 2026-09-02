import { Controller, Get, Param } from '@nestjs/common';
import { CatalogService } from './catalog.service';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('networks')
  listNetworks() {
    return this.catalogService.listNetworks();
  }

  @Get('data-plans/:networkCode')
  listDataPlans(@Param('networkCode') networkCode: string) {
    return this.catalogService.listDataPlans(networkCode);
  }
}
