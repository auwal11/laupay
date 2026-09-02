import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { LedgerModule } from '../ledger/ledger.module';
import { VtuModule } from '../vtu/vtu.module';

@Module({
  imports: [JwtModule.register({}), LedgerModule, VtuModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
