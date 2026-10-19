import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { DisputesService } from './disputes.service';

export const DISPUTE_REASONS = [
  'SERVICE_NOT_DELIVERED',
  'FAILED_BUT_DEBITED',
  'WRONG_AMOUNT',
  'DUPLICATE_TRANSACTION',
  'UNRECOGNIZED_TRANSACTION',
  'OTHER',
] as const;

class CreateDisputeDto {
  @IsString()
  @Length(1, 100)
  transactionId!: string;

  @IsString()
  @IsIn(DISPUTE_REASONS)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('disputes')
export class DisputesController {
  constructor(private readonly disputes: DisputesService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDisputeDto) {
    return this.disputes.create(user.userId, dto.transactionId, dto.reason, dto.details);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.disputes.list(user.userId);
  }
}
