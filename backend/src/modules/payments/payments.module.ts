import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PAYMENT_PROVIDER } from './providers/payment-provider.interface';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [JwtModule.register({}), LedgerModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    // Provider binding — swapping to a real provider later (Paystack, etc.)
    // is a one-line change here. No other file needs to change.
    // See ADR 0001 and docs/architecture/payment-flow.md.
    { provide: PAYMENT_PROVIDER, useClass: MockPaymentProvider },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
