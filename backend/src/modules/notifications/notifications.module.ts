import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { TransactionAlertDeliveryService } from './transaction-alert-delivery.service';
import { ExpoPushProvider } from './expo-push.provider';
import { PushNotificationDeliveryService } from './push-notification-delivery.service';

@Module({
  imports: [JwtModule.register({}), AuthModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, TransactionAlertDeliveryService, ExpoPushProvider, PushNotificationDeliveryService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
