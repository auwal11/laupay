import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
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

  @Get('banks')
  banks() {
    return this.withdrawals.listBanks();
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.withdrawals.listForUser(user.userId);
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.withdrawals.getForUser(user.userId, id);
  }
}
