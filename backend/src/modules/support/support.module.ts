import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';

@Module({
  imports: [JwtModule.register({}), AuthModule, NotificationsModule],
  controllers: [SupportController],
  providers: [SupportService, PermissionsGuard, RolesGuard],
})
export class SupportModule {}
