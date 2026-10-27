import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { LoginDto, RefreshDto, RegisterDto, ResendOtpDto, VerifyOtpDto } from './dto/auth.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password-reset.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly otpService: OtpService,
    private readonly prisma: PrismaService,
  ) {}

  // Stricter rate limit than the global default — blunts credential
  // stuffing / brute force per docs/security/security-model.md §4.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /**
   * Confirms the 6-digit code emailed by /auth/register. Returns tokens ONLY
   * on success — this is the sole path out of PENDING_VERIFICATION.
   */
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('verify-otp')
  verifyOtp(@Body() dto: VerifyOtpDto, @Req() req: Request) {
    return this.authService.verifyEmail(dto, req.ip);
  }

  /**
   * Re-issues a code for a still-unverified account. Deliberately returns an
   * identical shape whether or not the account exists, so this cannot be used
   * to enumerate registered addresses.
   */
  @Throttle({ default: { limit: 3, ttl: 300_000 } })
  @Post('resend-otp')
  async resendOtp(@Body() dto: ResendOtpDto, @Req() req: Request) {
    await this.otpService.assertResendAllowed(dto.email, req.ip ?? 'unknown');
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (user && user.status === 'PENDING_VERIFICATION') {
      await this.otpService.issue(user.id);
    }
    return { sent: true, message: 'If that account is awaiting verification, a code has been sent.' };
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, req.ip);
  }

  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) { return this.authService.forgotPassword(dto.email); }

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) { return this.authService.resetPassword(dto.token, dto.password); }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('change-password')
  changePassword(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.userId, dto.currentPassword, dto.newPassword);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  logout(@Body() dto: RefreshDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    const record = await this.prisma.user.findUniqueOrThrow({ where: { id: user.userId } });
    return {
      id: record.id,
      email: record.email,
      fullName: record.fullName,
      phone: record.phone,
      profilePhotoUrl: record.profilePhotoUrl,
      role: record.role,
      status: record.status,
    };
  }
}
