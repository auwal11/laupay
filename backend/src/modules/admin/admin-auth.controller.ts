import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from '../auth/auth.service';
import { AdminLoginDto } from './dto/admin.dto';

/**
 * Separate from AdminController so the login route can be public while every
 * other /admin route requires an authenticated ADMIN/SUPPORT token. Rate
 * limits are stricter than the global default to blunt credential stuffing.
 */
@Controller('admin')
export class AdminAuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  login(@Body() dto: AdminLoginDto) {
    return this.authService.adminLogin(dto);
  }
}
