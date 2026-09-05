import { Module } from '@nestjs/common';
import { ReconciliationService } from './reconciliation.service';
import { PaymentsModule } from '../payments/payments.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [PaymentsModule, OrdersModule],
  providers: [ReconciliationService],
  exports: [ReconciliationService],
})
export class ReconciliationModule {}
