import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { Permission, permissionsForRole } from '../permissions';

/**
 * Must run after JwtAuthGuard. Enforces the @RequirePermissions(...) set for
 * the route against the caller's role defaults plus any explicit
 * AdminPermissionGrant rows. This is the API-level control; the web console
 * only mirrors it for usability.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user?.userId) throw new ForbiddenException('Admin identity required');

    const rolePerms = permissionsForRole(user.role);
    let granted: Permission[] = [];
    if (!rolePerms.includes('admins.manage')) {
      const overrides = await this.prisma.adminPermissionGrant.findMany({
        where: { userId: user.userId },
        select: { permission: true },
      });
      granted = overrides.map((o) => o.permission as Permission);
    }
    const effective = new Set<Permission>([...rolePerms, ...granted]);
    const missing = required.filter((p) => !effective.has(p));
    if (missing.length > 0) {
      throw new ForbiddenException(
        `You do not have permission to perform this action (missing: ${missing.join(', ')})`,
      );
    }
    request.adminPermissions = [...effective];
    return true;
  }
}
