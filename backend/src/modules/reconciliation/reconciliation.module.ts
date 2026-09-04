import { Module } from '@nestjs/common';
import { ReconciliationService } from './reconciliation.service';
import { PaymentsModule } from '../payments/payments.module';
import { VtuModule } from '../vtu/vtu.module';

@Module({
  imports: [PaymentsModule, VtuModule],
  providers: [ReconciliationService],
  exports: [ReconciliationService],
})
export class ReconciliationModule {}
