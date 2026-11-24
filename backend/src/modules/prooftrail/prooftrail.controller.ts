import { Body, Controller, Get, Headers, Param, Post, Req, UploadedFile, UseGuards, UseInterceptors, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AppConfigService } from '../../config/app-config.service';
import { ProoftrailService } from './prooftrail.service';
import { DISPUTE_REASONS } from '../disputes/disputes.controller';

class CreateProoftrailDisputeDto {
  @IsString() @Length(1, 100) transactionId!: string;
  @IsString() @IsIn(DISPUTE_REASONS) reason!: string;
  @IsOptional() @IsString() @MaxLength(1000) details?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('prooftrail/disputes')
export class ProoftrailController {
  constructor(private readonly prooftrail: ProoftrailService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateProoftrailDisputeDto) {
    return this.prooftrail.create(user.userId, dto.transactionId, dto.reason, dto.details);
  }

  @Get(':caseId')
  status(@CurrentUser() user: AuthenticatedUser, @Param('caseId') caseId: string) {
    return this.prooftrail.status(user.userId, caseId);
  }

  @Post(':caseId/evidence')
  @UseInterceptors(FileInterceptor('file'))
  evidence(@CurrentUser() user: AuthenticatedUser, @Param('caseId') caseId: string, @UploadedFile() file?: { buffer: Buffer; originalname: string; mimetype: string }) {
    if (!file) throw new BadRequestException('Choose an evidence file');
    return this.prooftrail.evidence(user.userId, caseId, file);
  }
}

@Controller('prooftrail/webhooks')
export class ProoftrailWebhookController {
  constructor(private readonly prooftrail: ProoftrailService, private readonly config: AppConfigService) {}

  @Post()
  async webhook(@Headers('x-prooftrail-event-id') eventId: string, @Headers('x-prooftrail-timestamp') timestamp: string, @Headers('x-prooftrail-signature') signature: string, @Req() request: Request & { rawBody?: Buffer }) {
    if (!this.config.prooftrailEnabled) throw new UnauthorizedException('ProofTrail integration is not enabled');
    const raw = request.rawBody?.toString('utf8');
    if (!eventId || !timestamp || !signature || raw === undefined) throw new UnauthorizedException('Invalid ProofTrail webhook headers');
    const seconds = Number(timestamp);
    if (!Number.isInteger(seconds) || Math.abs(Math.floor(Date.now() / 1000) - seconds) > 300) throw new UnauthorizedException('Expired ProofTrail webhook');
    const expected = `sha256=${createHmac('sha256', this.config.prooftrailWebhookSecret).update(`${timestamp}.${raw}`).digest('hex')}`;
    const left = Buffer.from(expected); const right = Buffer.from(signature);
    if (left.length !== right.length || !timingSafeEqual(left, right)) throw new UnauthorizedException('Invalid ProofTrail webhook signature');
    let payload: Record<string, unknown>;
    try { payload = JSON.parse(raw) as Record<string, unknown>; } catch { throw new BadRequestException('Invalid webhook JSON'); }
    return this.prooftrail.receiveWebhook(eventId, payload);
  }
}
