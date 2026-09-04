import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { PaymentsModule } from '../payments/payments.module';
import { VtuModule } from '../vtu/vtu.module';

@Module({
  imports: [PaymentsModule, VtuModule],
  controllers: [WebhooksController],
})
export class WebhooksModule {}
