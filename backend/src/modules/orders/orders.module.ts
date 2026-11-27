import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { LedgerModule } from '../ledger/ledger.module';
import { VtuModule } from '../vtu/vtu.module';
import { SecurityModule } from '../security/security.module';
import { RiskModule } from '../risk/risk.module';

@Module({
  imports: [JwtModule.register({}), LedgerModule, VtuModule, SecurityModule, RiskModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
