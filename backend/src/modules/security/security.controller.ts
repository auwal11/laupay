import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SecurityService } from './security.service';
import { ChangePinDto, SetPinDto, VerifyPinDto } from './dto/security.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

/**
 * Minimum PIN backend to unblock apps/customer-web's security pages — see
 * docs/decisions/0004-customer-web-integration-audit.md §3.3.
 *
 * NOT implemented here (deliberately, not silently forgotten):
 *   - POST /security/pin/forgot — needs a secure identity-verification step
 *     (e.g. phone OTP) that does not exist in the backend yet. Building a
 *     "forgot PIN" flow without one would itself be a security hole (an
 *     attacker who can trigger it bypasses the PIN entirely), so it is
 *     intentionally left out rather than faked.
 *   - Device management, security notifications — see the ADR; lower
 *     priority, the frontend degrades reasonably with these left unbuilt.
 */
@UseGuards(JwtAuthGuard)
@Throttle({ default: { limit: 10, ttl: 60_000 } })
@Controller('security')
export class SecurityController {
  constructor(private readonly securityService: SecurityService) {}

  @Get('pin/status')
  getPinStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.securityService.getPinStatus(user.userId);
  }

  @Post('pin')
  setPin(@CurrentUser() user: AuthenticatedUser, @Body() dto: SetPinDto) {
    return this.securityService.setPin(user.userId, dto.pin);
  }

  @Post('pin/change')
  changePin(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChangePinDto) {
    return this.securityService.changePin(user.userId, dto.currentPin, dto.newPin);
  }

  @Post('pin/verify')
  async verifyPin(@CurrentUser() user: AuthenticatedUser, @Body() dto: VerifyPinDto) {
    await this.securityService.verifyPin(user.userId, dto.pin);
    return { verified: true };
  }

  @Get('devices')
  devices(@CurrentUser() user: AuthenticatedUser) { return this.securityService.getDevices(user.userId); }

  @Post('devices/:id/revoke')
  revokeDevice(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) { return this.securityService.revokeDevice(user.userId, id); }

  @Get('notifications')
  notifications(@CurrentUser() user: AuthenticatedUser) { return this.securityService.getNotifications(user.userId); }
}
