import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PAYMENT_PROVIDER } from './providers/payment-provider.interface';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { PaystackPaymentProvider } from './providers/paystack-payment.provider';
import { MonnifyPaymentProvider } from './providers/monnify-payment.provider';
import { LedgerModule } from '../ledger/ledger.module';
import { RiskModule } from '../risk/risk.module';
import { AppConfigService } from '../../config/app-config.service';

/**
 * Provider binding is driven by PAYMENT_PROVIDER (requirement 2):
 *   `paystack` | `monnify` → real TEST/SANDBOX integration (staging)
 *   `mock`                → MockPaymentProvider, reserved for automated
 *                            tests and local dev only — never staging UX.
 * Business logic still talks only to the PAYMENT_PROVIDER interface,
 * so no other file changes when swapping providers. See ADR 0001.
 */
const paymentProviderFactory = {
  provide: PAYMENT_PROVIDER,
  inject: [AppConfigService],
  useFactory: (config: AppConfigService) => {
    if (config.paymentProvider === 'paystack') return new PaystackPaymentProvider(config);
    if (config.paymentProvider === 'monnify') return new MonnifyPaymentProvider(config);
    return new MockPaymentProvider();
  },
};

@Module({
  imports: [JwtModule.register({}), LedgerModule, RiskModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, paymentProviderFactory],
  exports: [PaymentsService],
})
export class PaymentsModule {}
