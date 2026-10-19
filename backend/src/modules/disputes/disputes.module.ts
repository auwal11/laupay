import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DisputesController } from './disputes.controller';
import { DisputesService } from './disputes.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [DisputesController],
  providers: [DisputesService],
})
export class DisputesModule {}
