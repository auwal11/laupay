import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

/**
 * Every route here requires ADMIN role via RolesGuard — normal users
 * (CUSTOMER/AGENT) are rejected with 403 regardless of authentication.
 * See docs/security/security-model.md §2.
 *
 * NOTE: this is a minimal starting slice (dashboard stats only). Full
 * admin coverage (user management, order management, reconciliation views,
 * audit log browsing) is listed as not-yet-implemented in
 * docs/decisions/00-project-status.md §2.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

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
}
