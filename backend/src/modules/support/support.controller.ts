import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminSupportUpdateDto, CreateSupportTicketDto, SupportListQueryDto, SupportMessageDto } from './dto/support.dto';
import { SupportService } from './support.service';

@Controller('support')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Post('tickets')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  createPublic(@Body() dto: CreateSupportTicketDto) { return this.support.create(dto); }

  @UseGuards(JwtAuthGuard)
  @Post('tickets/me')
  createMine(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSupportTicketDto) { return this.support.create(dto, user.userId); }

  @UseGuards(JwtAuthGuard)
  @Get('tickets')
  listMine(@CurrentUser() user: AuthenticatedUser) { return this.support.listMine(user.userId); }

  @UseGuards(JwtAuthGuard)
  @Get('tickets/:id')
  getMine(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.support.getMine(user.userId, id); }

  @UseGuards(JwtAuthGuard)
  @Post('tickets/:id/replies')
  reply(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: SupportMessageDto) { return this.support.replyMine(user.userId, id, dto.body); }

  @Get('track')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  track(@Query('ticketNumber') ticketNumber: string, @Query('token') token: string) { return this.support.track(ticketNumber, token); }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPPORT, UserRole.FINANCE, UserRole.VIEWER)
  @RequirePermissions('support.read')
  @Get('/admin/tickets')
  adminList(@Query() query: SupportListQueryDto) { return this.support.adminList(query); }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPPORT, UserRole.FINANCE, UserRole.VIEWER)
  @RequirePermissions('support.read')
  @Get('/admin/tickets/:id')
  adminGet(@Param('id') id: string) { return this.support.adminGet(id); }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPPORT, UserRole.FINANCE)
  @RequirePermissions('support.manage')
  @Post('/admin/tickets/:id')
  adminUpdate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: AdminSupportUpdateDto) { return this.support.adminUpdate(id, user.userId, dto); }
}
