import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  getMyWallet(@CurrentUser() user: AuthenticatedUser) {
    return this.walletService.getMyWallet(user.userId);
  }

  @Get('transactions')
  getMyTransactions(@CurrentUser() user: AuthenticatedUser) {
    return this.walletService.getMyTransactions(user.userId);
  }

  @Get('transactions/:id')
  getMyTransaction(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.walletService.getMyTransaction(user.userId, id);
  }
}
