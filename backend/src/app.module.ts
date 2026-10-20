import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { VtuModule } from './modules/vtu/vtu.module';
import { OrdersModule } from './modules/orders/orders.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { AdminModule } from './modules/admin/admin.module';
import { ReconciliationModule } from './modules/reconciliation/reconciliation.module';
import { SecurityModule } from './modules/security/security.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { CreditsModule } from './modules/credits/credits.module';
import { DisputesModule } from './modules/disputes/disputes.module';
import { SettingsModule } from './modules/settings/settings.module';
import { BeneficiariesModule } from './modules/beneficiaries/beneficiaries.module';
import { RiskModule } from './modules/risk/risk.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    SettingsModule,
    RiskModule,
    ScheduleModule.forRoot(),
    // Global default rate limit; specific routes (auth, webhooks) apply
    // stricter limits via @Throttle(...) — see security-model.md §4.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    LedgerModule,
    AuthModule,
    UsersModule,
    WalletModule,
    CatalogModule,
    PaymentsModule,
    VtuModule,
    OrdersModule,
    WebhooksModule,
    AdminModule,
    ReconciliationModule,
    SecurityModule,
    NotificationsModule,
    CreditsModule,
    DisputesModule,
    BeneficiariesModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
