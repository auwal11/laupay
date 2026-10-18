import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminAuthController } from './admin-auth.controller';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminBootstrapService } from './admin-bootstrap.service';
import { AuthModule } from '../auth/auth.module';
import { CreditsModule } from '../credits/credits.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReconciliationModule } from '../reconciliation/reconciliation.module';

@Module({
  imports: [
    JwtModule.register({}),
    AuthModule,
    CreditsModule,
    NotificationsModule,
    ReconciliationModule,
  ],
  controllers: [AdminAuthController, AdminController],
  providers: [AdminService, AdminBootstrapService],
})
export class AdminModule {}
