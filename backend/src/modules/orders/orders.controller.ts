import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { IsNumber, IsOptional, IsPositive, IsString, Matches, MaxLength, MinLength } from 'class-validator';
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

  @IsString()
  @Matches(/^\d{4}$/)
  pin!: string;
}

class CreateDataOrderDto {
  @IsString()
  network!: string;

  @IsString()
  phoneNumber!: string;

  // DataPlan IDs are catalog-owned opaque strings (the seed/provider catalog
  // may use codes such as MTN-seed-1gb), not necessarily UUIDs. The service
  // still resolves the ID against the authenticated order flow and takes the
  // price only from the database record.
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  dataPlanId!: string;

  @IsString()
  idempotencyKey!: string;

  @IsString()
  @Matches(/^\d{4}$/)
  pin!: string;
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
      dto.pin,
    );
  }

  @Post('data')
  createData(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDataOrderDto) {
    return this.ordersService.createDataOrder(
      user.userId,
      dto.network,
      dto.phoneNumber,
      dto.dataPlanId,
      dto.idempotencyKey,
      dto.pin,
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
