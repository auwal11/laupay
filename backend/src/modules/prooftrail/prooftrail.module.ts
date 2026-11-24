import { Module } from '@nestjs/common';
import { DisputesModule } from '../disputes/disputes.module';
import { ProoftrailClient } from './prooftrail.client';
import { ProoftrailController, ProoftrailWebhookController } from './prooftrail.controller';
import { ProoftrailService } from './prooftrail.service';

@Module({
  imports: [DisputesModule],
  controllers: [ProoftrailController, ProoftrailWebhookController],
  providers: [ProoftrailClient, ProoftrailService],
  exports: [ProoftrailService],
})
export class ProoftrailModule {}
