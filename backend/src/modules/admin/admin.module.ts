import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminAuthController } from './admin-auth.controller';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminOpsService } from './admin-ops.service';
import { AdminBootstrapService } from './admin-bootstrap.service';
import { AuthModule } from '../auth/auth.module';
import { CreditsModule } from '../credits/credits.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReconciliationModule } from '../reconciliation/reconciliation.module';
import { LedgerModule } from '../ledger/ledger.module';
import { OrdersModule } from '../orders/orders.module';
import { RiskModule } from '../risk/risk.module';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@Module({
  imports: [
    JwtModule.register({}),
    AuthModule,
    CreditsModule,
    NotificationsModule,
    ReconciliationModule,
    LedgerModule,
    OrdersModule,
    RiskModule,
  ],
  controllers: [AdminAuthController, AdminController],
  providers: [AdminService, AdminOpsService, AdminBootstrapService, PermissionsGuard],
})
export class AdminModule {}
