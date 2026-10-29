import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { VtuModule } from '../vtu/vtu.module';

@Module({
  imports: [VtuModule],
  controllers: [CatalogController],
  providers: [CatalogService],
})
export class CatalogModule {}
