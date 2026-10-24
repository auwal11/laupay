import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminSupportUpdateDto, SupportListQueryDto } from './dto/support.dto';
import { SupportService } from './support.service';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('admin/support')
export class AdminSupportController {
  constructor(private readonly support: SupportService) {}

  @Roles(UserRole.ADMIN, UserRole.SUPPORT, UserRole.FINANCE, UserRole.VIEWER)
  @RequirePermissions('support.read')
  @Get('tickets')
  adminList(@Query() query: SupportListQueryDto) { return this.support.adminList(query); }

  @Roles(UserRole.ADMIN, UserRole.SUPPORT, UserRole.FINANCE, UserRole.VIEWER)
  @RequirePermissions('support.read')
  @Get('tickets/:id')
  adminGet(@Param('id') id: string) { return this.support.adminGet(id); }

  @Roles(UserRole.ADMIN, UserRole.SUPPORT, UserRole.FINANCE)
  @RequirePermissions('support.manage')
  @Post('tickets/:id')
  adminUpdate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: AdminSupportUpdateDto) { return this.support.adminUpdate(id, user.userId, dto); }
}
