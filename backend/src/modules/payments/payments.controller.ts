import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { PaymentsService } from './payments.service';
import { ConfirmCashDto, EnsureVirtualAccountDto, InitializeFundingDto } from './dto/payments.dto';
import { VirtualAccountsService } from './virtual-accounts.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly virtualAccounts: VirtualAccountsService,
  ) {}

  @Post('initialize')
  initialize(@CurrentUser() user: AuthenticatedUser, @Body() dto: InitializeFundingDto) {
    return this.paymentsService.initializeWalletFunding(user.userId, dto.amount, dto.idempotencyKey);
  }

  @Get('virtual-account')
  async virtualAccount(@CurrentUser() user: AuthenticatedUser) {
    return { account: await this.virtualAccounts.getForUser(user.userId) };
  }

  /** Idempotent: returns the existing account or creates it on first call. */
  @Post('virtual-account')
  ensureVirtualAccount(@CurrentUser() user: AuthenticatedUser, @Body() dto: EnsureVirtualAccountDto) {
    return this.virtualAccounts.ensureForUser(user.userId, dto.bvn);
  }

  @Roles(UserRole.AGENT)
  @Post('confirm-cash')
  confirmCash(@CurrentUser() user: AuthenticatedUser, @Body() dto: ConfirmCashDto) {
    return this.paymentsService.confirmAgentCash(user.userId, dto.orderId);
  }
}
