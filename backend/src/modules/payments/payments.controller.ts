import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { PaymentsService } from './payments.service';
import { ConfirmCashDto, InitializeFundingDto } from './dto/payments.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('initialize')
  initialize(@CurrentUser() user: AuthenticatedUser, @Body() dto: InitializeFundingDto) {
    return this.paymentsService.initializeWalletFunding(user.userId, dto.amount, dto.idempotencyKey);
  }

  @Roles(UserRole.AGENT)
  @Post('confirm-cash')
  confirmCash(@CurrentUser() user: AuthenticatedUser, @Body() dto: ConfirmCashDto) {
    return this.paymentsService.confirmAgentCash(user.userId, dto.orderId, dto.amount);
  }
}
