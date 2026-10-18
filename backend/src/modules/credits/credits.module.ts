import { Module } from '@nestjs/common';
import { CreditsService } from './credits.service';
import { LedgerModule } from '../ledger/ledger.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [LedgerModule, NotificationsModule],
  providers: [CreditsService],
  exports: [CreditsService],
})
export class CreditsModule {}
