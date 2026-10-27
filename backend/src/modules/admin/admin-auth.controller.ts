import { Body, Controller, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
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

  // Database-backed lockout lives in AuthService; see LoginThrottleService.
  @Post('login')
  login(@Body() dto: AdminLoginDto, @Req() req: Request) {
    return this.authService.adminLogin(dto, req.ip);
  }
}
