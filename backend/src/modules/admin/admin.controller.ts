import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserRole, WalletStatus } from '@prisma/client';
import type { Request, Response } from 'express';
import { AdminService } from './admin.service';
import { AdminOpsService, AdminActor } from './admin-ops.service';
import {
  AuditListQueryDto,
  CreditTestFundsDto,
  WalletDebitBalanceDto,
  ClearTestBalancesDto,
  OrderListQueryDto,
  TransactionListQueryDto,
  UpdateSettingsDto,
  UserListQueryDto,
  WalletListQueryDto,
  DisputeListQueryDto,
  UpdateDisputeDto,
  FreezeUserDto,
  MarkVerifiedDto,
  AddNoteDto,
  SetRoleDto,
  WalletCreditDto,
  WalletDebitDto,
  ReverseEntryDto,
  OrderReasonDto,
  OpenDisputeDto,
  AssignDisputeDto,
  DisputeMessageDto,
  DisputeResolutionDto,
  UpdateSettingsBodyDto,
  KillSwitchDto,
  ProviderModeDto,
  BlacklistDto,
  RiskListQueryDto,
  ReportQueryDto,
  WithdrawalListQueryDto,
  RejectWithdrawalDto,
  WithdrawalActionDto,
  CreateStaffAccountDto,
  StaffListQueryDto,
} from './dto/admin.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ReconciliationService } from '../reconciliation/reconciliation.service';
import { SettingsService } from '../settings/settings.service';
import { RiskService } from '../risk/risk.service';
import { WithdrawalsService } from '../withdrawals/withdrawals.service';
import { AppConfigService } from '../../config/app-config.service';
import { ALL_PERMISSIONS, permissionsForRole } from '../../common/permissions';

/**
 * Admin console API. Every route requires a verified admin token; sensitive
 * routes additionally declare @RequirePermissions(...) which is enforced on
 * the server by PermissionsGuard (never only hidden in the UI).
 */
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(UserRole.ADMIN, UserRole.SUPPORT, UserRole.FINANCE, UserRole.VIEWER)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly ops: AdminOpsService,
    private readonly reconciliationService: ReconciliationService,
    private readonly settings: SettingsService,
    private readonly risk: RiskService,
    private readonly withdrawals: WithdrawalsService,
    private readonly config: AppConfigService,
  ) {}

  private actor(user: AuthenticatedUser, req: Request): AdminActor {
    return {
      adminId: user.userId,
      adminEmail: user.email,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    };
  }

  // ---- Session / capabilities ----
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    const isSuperAdmin = this.config.isConfiguredSuperAdmin(user.userId, user.email);
    return {
      userId: user.userId,
      role: user.role,
      permissions: isSuperAdmin ? [...ALL_PERMISSIONS] : permissionsForRole(user.role),
      isSuperAdmin,
      superAdminConfigured: this.config.superAdminIds.size > 0 || this.config.superAdminEmails.size > 0,
    };
  }

  @Get('overview')
  @RequirePermissions('overview.read')
  overview() {
    return this.admin.overview();
  }

  @Get('dashboard')
  @RequirePermissions('overview.read')
  dashboard() {
    return this.admin.overview();
  }

  // ---- Users ----
  @Get('users')
  @RequirePermissions('users.read')
  listUsers(@Query() q: UserListQueryDto) {
    return this.admin.listUsers(q);
  }

  @Post('staff')
  @RequirePermissions('admins.manage')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  createStaff(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateStaffAccountDto,
    @Req() req: Request,
  ) {
    return this.admin.createStaffAccount(dto.email, dto.fullName, dto.role, dto.reason, user.userId, req.ip, user.email);
  }

  @Get('staff')
  @RequirePermissions('admins.manage')
  listStaff(@CurrentUser() user: AuthenticatedUser, @Query() q: StaffListQueryDto) {
    return this.admin.listStaffAccounts(user.userId, user.email, q);
  }

  @Post('staff/:id/revoke')
  @RequirePermissions('admins.manage')
  revokeStaff(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FreezeUserDto,
    @Req() req: Request,
  ) {
    return this.ops.revokeStaffAccess(id, this.actor(user, req), dto.reason);
  }

  @Get('users/:id')
  @RequirePermissions('users.read')
  getUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.ops.userDetail(id);
  }

  @Post('users/:id/freeze')
  @RequirePermissions('users.freeze')
  freezeUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FreezeUserDto,
    @Req() req: Request,
  ) {
    return this.ops.freezeUser(id, this.actor(user, req), dto.reason);
  }

  @Post('users/:id/unfreeze')
  @RequirePermissions('users.freeze')
  unfreezeUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FreezeUserDto,
    @Req() req: Request,
  ) {
    return this.ops.unfreezeUser(id, this.actor(user, req), dto.reason);
  }

  @Post('users/:id/close')
  @RequirePermissions('users.manage')
  closeUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FreezeUserDto,
    @Req() req: Request,
  ) {
    return this.ops.closeUser(id, this.actor(user, req), dto.reason);
  }

  @Post('users/:id/reopen')
  @RequirePermissions('users.manage')
  reopenUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FreezeUserDto,
    @Req() req: Request,
  ) {
    return this.ops.reopenUser(id, this.actor(user, req), dto.reason);
  }

  @Post('users/:id/reset-pin')
  @RequirePermissions('users.manage')
  resetPin(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FreezeUserDto,
    @Req() req: Request,
  ) {
    return this.ops.resetPin(id, this.actor(user, req), dto.reason);
  }

  @Post('users/:id/force-logout')
  @RequirePermissions('users.manage')
  forceLogout(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FreezeUserDto,
    @Req() req: Request,
  ) {
    return this.ops.forceLogout(id, this.actor(user, req), dto.reason);
  }

  @Post('users/:id/verify')
  @RequirePermissions('users.manage')
  markVerified(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarkVerifiedDto,
    @Req() req: Request,
  ) {
    return this.ops.markVerified(id, dto.field, this.actor(user, req), dto.reason);
  }

  @Post('users/:id/notes')
  @RequirePermissions('users.manage')
  addNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddNoteDto,
    @Req() req: Request,
  ) {
    return this.ops.addNote(id, dto.body, this.actor(user, req));
  }

  @Post('users/:id/role')
  @RequirePermissions('admins.manage')
  setRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetRoleDto,
    @Req() req: Request,
  ) {
    return this.ops.setRole(id, dto.role, this.actor(user, req), dto.reason);
  }

  /** Audited manual wallet credit (ledger-backed; never a raw balance write). */
  @Post('wallets/credit')
  @RequirePermissions('wallets.adjust')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  creditWallet(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: WalletCreditDto,
    @Req() req: Request,
  ) {
    return this.ops.creditWallet(dto.userId, dto.amount, dto.reason, dto.note, this.actor(user, req), dto.idempotencyKey);
  }

  @Post('wallets/debit')
  @RequirePermissions('wallets.adjust')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  debitWallet(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: WalletDebitDto,
    @Req() req: Request,
  ) {
    return this.ops.debitWallet(dto.userId, dto.amount, dto.reason, dto.note, this.actor(user, req), dto.idempotencyKey);
  }

  @Post('wallets/debit-balance')
  @RequirePermissions('wallets.adjust')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  debitWalletBalance(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: WalletDebitBalanceDto,
    @Req() req: Request,
  ) {
    return this.ops.debitWalletBalance(dto.userId, dto.reason, dto.note, this.actor(user, req), dto.idempotencyKey);
  }

  /** Removes currently available test-credit funds via audited ledger entries. */
  @Post('wallets/clear-test-balances')
  @RequirePermissions('wallets.clear_test_balances')
  @Throttle({ default: { limit: 2, ttl: 60_000 } })
  clearTestBalances(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ClearTestBalancesDto,
    @Req() req: Request,
  ) {
    return this.ops.clearAllTestBalances(dto.reason, this.actor(user, req), dto.idempotencyKey);
  }

  @Post('ledger/:id/reverse')
  @RequirePermissions('ledger.reverse')
  reverseEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReverseEntryDto,
    @Req() req: Request,
  ) {
    return this.ops.reverseEntry(id, dto.reason, this.actor(user, req));
  }

  @Get('finance/float')
  @RequirePermissions('wallets.read')
  floatSummary() {
    return this.ops.floatSummary();
  }

  @Get('reports/reconciliation')
  @RequirePermissions('reports.read')
  reconciliation(@Query() q: ReportQueryDto) {
    return this.ops.dailyReconciliation(q.from, q.to);
  }

  @Get('reports/summary')
  @RequirePermissions('reports.read')
  report(@Query() q: ReportQueryDto) {
    return this.ops.report(q.from, q.to);
  }

  // ---- Transactions (global ledger view) ----
  @Get('transactions')
  @RequirePermissions('wallets.read')
  listTransactions(@Query() q: TransactionListQueryDto) {
    return this.admin.listTransactions(q);
  }

  @Get('transactions/export')
  @RequirePermissions('reports.read')
  async exportTransactions(@Query() q: TransactionListQueryDto, @Res({ passthrough: true }) res: Response) {
    const csv = await this.ops.exportTransactionsCsv(q);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="transactions-${Date.now()}.csv"`);
    return csv;
  }

  @Get('transactions/:id')
  @RequirePermissions('wallets.read')
  getTransaction(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.getTransaction(id);
  }

  // ---- Wallets ----
  @Get('withdrawals')
  @RequirePermissions('wallets.read')
  listWithdrawals(@Query() q: WithdrawalListQueryDto) {
    return this.withdrawals.listAll(q.status as any, q.search);
  }

  @Get('withdrawals/:id')
  @RequirePermissions('withdrawals.read')
  getWithdrawal(@Param('id', ParseUUIDPipe) id: string) {
    return this.withdrawals.getAdmin(id);
  }

  @Post('withdrawals/:id/approve')
  @RequirePermissions('withdrawals.manage')
  approveWithdrawal(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: WithdrawalActionDto) {
    return this.withdrawals.approve(user.userId, id, dto.reason);
  }

  @Post('withdrawals/:id/process')
  @RequirePermissions('withdrawals.manage')
  processWithdrawal(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: WithdrawalActionDto) {
    return this.withdrawals.startProcessing(user.userId, id, dto.reason);
  }

  @Post('withdrawals/:id/successful')
  @RequirePermissions('withdrawals.manage')
  successfulWithdrawal(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: WithdrawalActionDto) {
    return this.withdrawals.markSuccessful(user.userId, id, dto.reason, dto.providerReference ?? '', dto.evidence ?? '');
  }

  @Post('withdrawals/:id/failed')
  @RequirePermissions('withdrawals.manage')
  failedWithdrawal(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: WithdrawalActionDto) {
    return this.withdrawals.markFailed(user.userId, id, dto.reason);
  }

  @Post('withdrawals/:id/reject')
  @RequirePermissions('withdrawals.manage')
  rejectWithdrawal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectWithdrawalDto,
  ) {
    return this.withdrawals.reject(user.userId, id, dto.reason);
  }

  @Post('withdrawals/:id/refund')
  @RequirePermissions('withdrawals.refund')
  refundWithdrawal(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: WithdrawalActionDto) {
    return this.withdrawals.refund(user.userId, id, dto.reason);
  }

  @Get('wallets')
  @RequirePermissions('wallets.read')
  listWallets(@Query() q: WalletListQueryDto) {
    return this.admin.listWallets(q);
  }

  @Get('wallets/:id')
  @RequirePermissions('wallets.read')
  getWallet(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.getWallet(id);
  }

  @Post('wallets/:id/freeze')
  @RequirePermissions('wallets.adjust')
  freezeWallet(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FreezeUserDto,
    @Req() req: Request,
  ) {
    return this.admin.setWalletStatus(id, WalletStatus.FROZEN, this.actor(user, req), dto.reason);
  }

  @Post('wallets/:id/unfreeze')
  @RequirePermissions('wallets.adjust')
  unfreezeWallet(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FreezeUserDto,
    @Req() req: Request,
  ) {
    return this.admin.setWalletStatus(id, WalletStatus.ACTIVE, this.actor(user, req), dto.reason);
  }

  // ---- Orders ----
  @Get('orders')
  @RequirePermissions('orders.read')
  listOrders(@Query() q: OrderListQueryDto) {
    return this.admin.listOrders(q);
  }

  @Get('orders/export')
  @RequirePermissions('reports.read')
  async exportOrders(@Query() q: OrderListQueryDto, @Res({ passthrough: true }) res: Response) {
    const csv = await this.ops.exportOrdersCsv(q);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="orders-${Date.now()}.csv"`);
    return csv;
  }

  @Get('orders/:id')
  @RequirePermissions('orders.read')
  orderDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.ops.orderDetail(id);
  }

  @Post('orders/:id/retry')
  @RequirePermissions('orders.settle')
  retryOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.ops.retryOrder(id, this.actor(user, req));
  }

  @Post('orders/:id/mark-successful')
  @RequirePermissions('orders.settle')
  markOrderSuccessful(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OrderReasonDto,
    @Req() req: Request,
  ) {
    return this.ops.markOrderSuccessful(id, this.actor(user, req), dto.reason);
  }

  @Post('orders/:id/mark-failed')
  @RequirePermissions('orders.settle')
  markOrderFailed(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OrderReasonDto,
    @Req() req: Request,
  ) {
    return this.ops.markOrderFailed(id, this.actor(user, req), dto.reason);
  }

  @Post('orders/:id/dispute')
  @RequirePermissions('disputes.manage')
  openDispute(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OpenDisputeDto,
    @Req() req: Request,
  ) {
    return this.ops.openDisputeForOrder(id, dto.reason, dto.details, this.actor(user, req));
  }

  // ---- Disputes ----
  @Get('disputes')
  @RequirePermissions('disputes.read')
  listDisputes(@Query() q: DisputeListQueryDto) {
    return this.admin.listDisputes(q);
  }

  @Get('disputes/:id')
  @RequirePermissions('disputes.read')
  disputeDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.ops.disputeDetail(id);
  }

  @Post('disputes/:id/assign')
  @RequirePermissions('disputes.manage')
  assignDispute(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignDisputeDto,
    @Req() req: Request,
  ) {
    return this.ops.assignDispute(id, dto.adminId, this.actor(user, req), dto.reason);
  }

  @Post('disputes/:id/messages')
  @RequirePermissions('disputes.manage')
  addDisputeMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DisputeMessageDto,
    @Req() req: Request,
  ) {
    return this.ops.addDisputeMessage(id, this.actor(user, req), dto.body, !!dto.internal);
  }

  @Post('disputes/:id/refund')
  @RequirePermissions('disputes.refund')
  refundDispute(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DisputeResolutionDto,
    @Req() req: Request,
  ) {
    return this.ops.approveDisputeRefund(id, this.actor(user, req), dto.reason, dto.note);
  }

  @Post('disputes/:id/reject')
  @RequirePermissions('disputes.manage')
  rejectDispute(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DisputeResolutionDto,
    @Req() req: Request,
  ) {
    return this.ops.rejectDispute(id, this.actor(user, req), dto.reason, dto.note);
  }

  @Patch('disputes/:id')
  @RequirePermissions('disputes.manage')
  updateDispute(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDisputeDto,
    @Req() req: Request,
  ) {
    return this.admin.updateDispute(id, dto.status, this.actor(user, req), dto.reason);
  }

  // ---- Audit ----
  @Get('audit')
  @RequirePermissions('audit.read')
  listAudit(@Query() q: AuditListQueryDto) {
    return this.admin.listAudit(q);
  }

  // ---- Settings ----
  @Get('settings')
  @RequirePermissions('settings.read')
  async getSettings() {
    const snapshot = await this.settings.snapshot();
    return {
      ...(await this.admin.getSettings()),
      settings: snapshot.settings,
      effective: snapshot.effective,
      blacklist: await this.settings.getBlacklistedPhones(),
    };
  }

  @Patch('settings')
  @RequirePermissions('settings.write')
  updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateSettingsDto,
    @Req() req: Request,
  ) {
    return this.admin.updateSettings(dto, user.userId, req.ip);
  }

  @Post('settings/update')
  @RequirePermissions('settings.write')
  updateSettingsV2(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateSettingsBodyDto,
    @Req() req: Request,
  ) {
    return this.ops.updateSettings(dto.settings, this.actor(user, req), dto.reason);
  }

  @Post('settings/kill-switch')
  @RequirePermissions('settings.write')
  killSwitch(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: KillSwitchDto,
    @Req() req: Request,
  ) {
    return this.ops.setKillSwitch(dto.key, dto.paused, this.actor(user, req), dto.reason);
  }

  @Post('settings/provider-mode')
  @RequirePermissions('providers.switch_live')
  providerMode(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ProviderModeDto,
    @Req() req: Request,
  ) {
    return this.ops.switchProviderMode(dto.mode, dto.confirmation ?? '', this.actor(user, req), dto.reason);
  }

  // ---- Risk ----
  @Get('risk/events')
  @RequirePermissions('risk.read')
  riskEvents(@Query() q: RiskListQueryDto) {
    return this.risk.listEvents(q);
  }

  @Post('risk/blacklist')
  @RequirePermissions('risk.manage')
  blacklistPhone(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BlacklistDto,
    @Req() req: Request,
  ) {
    return this.ops.blacklistPhone(dto.phone, this.actor(user, req), dto.reason);
  }

  @Delete('risk/blacklist')
  @RequirePermissions('risk.manage')
  unblacklistPhone(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BlacklistDto,
    @Req() req: Request,
  ) {
    return this.ops.unblacklistPhone(dto.phone, this.actor(user, req), dto.reason);
  }

  // ---- Test credit ----
  @Post('credits/test')
  @RequirePermissions('users.credit')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  creditTestFunds(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreditTestFundsDto,
    @Req() req: Request,
  ) {
    return this.admin.creditTestFunds(dto.userId, dto.amount, user.userId, req.ip, dto.idempotencyKey);
  }

  @Post('reconciliation/run')
  @RequirePermissions('orders.settle')
  runReconciliation() {
    return this.reconciliationService.runOnce();
  }
}
