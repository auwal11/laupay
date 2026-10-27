import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UserStatus } from '@prisma/client';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header: string | undefined = request.headers['authorization'];
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or malformed Authorization header');
    }
    const token = header.slice('Bearer '.length);
    try {
      const payload = await this.jwt.verifyAsync(token, { secret: this.config.jwtAccessSecret });
      if (typeof payload.sub !== 'string' || typeof payload.iat !== 'number') {
        throw new UnauthorizedException('Invalid access token');
      }

      // Access tokens are deliberately checked against the current account
      // record. This makes freeze/close/force-logout effective immediately,
      // and prevents a stale role claim from retaining admin access after a
      // role change.
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, role: true, status: true, sessionsRevokedAt: true, mustChangePassword: true } as any,
      }) as ({ id: string; role: any; status: UserStatus; sessionsRevokedAt: Date | null; mustChangePassword?: boolean } | null);
      if (!user || user.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException('Account is not active');
      }
      if (user.sessionsRevokedAt && payload.iat * 1000 <= user.sessionsRevokedAt.getTime()) {
        throw new UnauthorizedException('Session has been revoked');
      }
      if (user.mustChangePassword && !String(request.path ?? '').endsWith('/auth/change-password')) {
        throw new UnauthorizedException('Password change required');
      }

      request.user = { userId: user.id, role: user.role };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
