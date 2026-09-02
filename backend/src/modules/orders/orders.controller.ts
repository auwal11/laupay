import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { IsNumber, IsPositive, IsString } from 'class-validator';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

class CreateAirtimeOrderDto {
  @IsString()
  network!: string;

  @IsString()
  phoneNumber!: string;

  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsString()
  idempotencyKey!: string;
}

@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('airtime')
  createAirtime(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAirtimeOrderDto) {
    return this.ordersService.createAirtimeOrder(
      user.userId,
      dto.network,
      dto.phoneNumber,
      dto.amount,
      dto.idempotencyKey,
    );
  }

  @Get()
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.ordersService.listMyOrders(user.userId);
  }

  @Get(':id')
  getOne(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.ordersService.getOrder(id, user.userId, user.role);
  }
}
