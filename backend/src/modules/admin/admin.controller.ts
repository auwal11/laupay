import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ReconciliationService } from '../reconciliation/reconciliation.service';

/**
 * Every route here requires ADMIN role via RolesGuard — normal users
 * (CUSTOMER/AGENT) are rejected with 403 regardless of authentication.
 * See docs/security/security-model.md §2.
 *
 * NOTE: this is a minimal starting slice (dashboard stats + manual
 * reconciliation trigger). Full admin coverage (user management, order
 * management, audit log browsing) is listed as not-yet-implemented in
 * docs/decisions/00-project-status.md §2.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reconciliationService: ReconciliationService,
  ) {}

  @Get('dashboard')
  async dashboard() {
    const [userCount, orderCount, walletCount, pendingPayments] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.order.count(),
      this.prisma.walletAccount.count(),
      this.prisma.payment.count({ where: { status: { in: ['PENDING', 'PROCESSING', 'UNKNOWN'] } } }),
    ]);
    return { userCount, orderCount, walletCount, pendingPayments };
  }

  /**
   * Manually triggers one reconciliation pass instead of waiting for the
   * scheduled job (docs/architecture/payment-flow.md §3). Useful for
   * resolving a specific incident immediately, and for tests.
   */
  @Post('reconciliation/run')
  async runReconciliation() {
    return this.reconciliationService.runOnce();
  }
}
