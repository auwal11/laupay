import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SecurityController } from './security.controller';
import { SecurityService } from './security.service';
import { AuthModule } from '../auth/auth.module';
import { CreditsModule } from '../credits/credits.module';

@Module({
  imports: [JwtModule.register({}), AuthModule, CreditsModule],
  controllers: [SecurityController],
  providers: [SecurityService],
  exports: [SecurityService],
})
export class SecurityModule {}
