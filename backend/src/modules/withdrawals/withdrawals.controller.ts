import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { WithdrawalsService } from './withdrawals.service';
import { RequestWithdrawalDto } from './dto/withdrawals.dto';

@UseGuards(JwtAuthGuard)
@Controller('withdrawals')
export class WithdrawalsController {
  constructor(private readonly withdrawals: WithdrawalsService) {}

  @Post()
  request(@CurrentUser() user: AuthenticatedUser, @Body() dto: RequestWithdrawalDto) {
    return this.withdrawals.request(user.userId, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.withdrawals.listForUser(user.userId);
  }
}
