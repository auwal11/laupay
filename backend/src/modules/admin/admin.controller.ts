import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserRole, WalletStatus } from '@prisma/client';
import type { Request } from 'express';
import { AdminService } from './admin.service';
import {
  AuditListQueryDto,
  CreditTestFundsDto,
  OrderListQueryDto,
  TransactionListQueryDto,
  UpdateSettingsDto,
  UserListQueryDto,
  WalletListQueryDto,
  DisputeListQueryDto,
  UpdateDisputeDto,
} from './dto/admin.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ReconciliationService } from '../reconciliation/reconciliation.service';

/**
 * Admin console API. All routes require a verified ADMIN or SUPPORT token
 * (RolesGuard). Money-moving and configuration routes tighten this further
 * to ADMIN only via a method-level @Roles(...), which overrides the class
 * default. See docs/security/security-model.md §2.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPPORT)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly reconciliationService: ReconciliationService,
  ) {}

  @Get('overview')
  overview() {
    return this.admin.overview();
  }

  /** Backwards-compatible alias for the original dashboard route. */
  @Get('dashboard')
  dashboard() {
    return this.admin.overview();
  }

  // ---- Users ----
  @Get('users')
  listUsers(@Query() q: UserListQueryDto) {
    return this.admin.listUsers(q);
  }

  @Get('users/:id')
  getUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.getUser(id);
  }

  // ---- Transactions (global ledger view) ----
  @Get('transactions')
  listTransactions(@Query() q: TransactionListQueryDto) {
    return this.admin.listTransactions(q);
  }

  @Get('transactions/:id')
  getTransaction(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.getTransaction(id);
  }

  // ---- Wallets ----
  @Get('wallets')
  listWallets(@Query() q: WalletListQueryDto) {
    return this.admin.listWallets(q);
  }

  @Get('wallets/:id')
  getWallet(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.getWallet(id);
  }

  @Roles(UserRole.ADMIN)
  @Post('wallets/:id/freeze')
  freezeWallet(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.admin.setWalletStatus(id, WalletStatus.FROZEN, user.userId, req.ip);
  }

  @Roles(UserRole.ADMIN)
  @Post('wallets/:id/unfreeze')
  unfreezeWallet(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.admin.setWalletStatus(id, WalletStatus.ACTIVE, user.userId, req.ip);
  }

  // ---- Orders ----
  @Get('orders')
  listOrders(@Query() q: OrderListQueryDto) {
    return this.admin.listOrders(q);
  }

  // ---- Audit ----
  @Get('audit')
  listAudit(@Query() q: AuditListQueryDto) {
    return this.admin.listAudit(q);
  }

  @Get('disputes')
  listDisputes(@Query() q: DisputeListQueryDto) {
    return this.admin.listDisputes(q);
  }

  @Patch('disputes/:id')
  updateDispute(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDisputeDto,
    @Req() req: Request,
  ) {
    return this.admin.updateDispute(id, dto.status, user.userId, req.ip);
  }

  // ---- Settings ----
  @Get('settings')
  getSettings() {
    return this.admin.getSettings();
  }

  @Roles(UserRole.ADMIN)
  @Patch('settings')
  updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateSettingsDto,
    @Req() req: Request,
  ) {
    return this.admin.updateSettings(dto, user.userId, req.ip);
  }

  // ---- Test credit ----
  @Roles(UserRole.ADMIN)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('credits/test')
  creditTestFunds(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreditTestFundsDto,
    @Req() req: Request,
  ) {
    return this.admin.creditTestFunds(dto.userId, dto.amount, user.userId, req.ip, dto.idempotencyKey);
  }

  /**
   * Manually triggers one reconciliation pass instead of waiting for the
   * scheduled job (docs/architecture/payment-flow.md §3).
   */
  @Roles(UserRole.ADMIN)
  @Post('reconciliation/run')
  runReconciliation() {
    return this.reconciliationService.runOnce();
  }
}
