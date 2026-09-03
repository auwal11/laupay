import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminController } from './admin.controller';
import { ReconciliationModule } from '../reconciliation/reconciliation.module';

@Module({
  imports: [JwtModule.register({}), ReconciliationModule],
  controllers: [AdminController],
})
export class AdminModule {}
