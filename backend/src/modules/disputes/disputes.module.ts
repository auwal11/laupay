import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DisputesController } from './disputes.controller';
import { DisputesService } from './disputes.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [JwtModule.register({}), NotificationsModule],
  controllers: [DisputesController],
  providers: [DisputesService],
})
export class DisputesModule {}
