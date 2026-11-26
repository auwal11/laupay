import { UnauthorizedException } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import { JwtAuthGuard } from './jwt-auth.guard';

function context(request: Record<string, unknown>) {
  request.headers = { authorization: 'Bearer token' };
  return { switchToHttp: () => ({ getRequest: () => request }) } as never;
}

function makeGuard(user: Record<string, unknown> | null, payload: { sub: string; role: UserRole; iat: number } = { sub: 'user-1', role: UserRole.CUSTOMER, iat: 100 }) {
  const jwt = { verifyAsync: jest.fn().mockResolvedValue(payload) };
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(
        user ? { email: 'user@example.com', ...user } : user,
      ),
    },
  };
  const guard = new JwtAuthGuard(jwt as never, { jwtAccessSecret: 'test-secret' } as never, prisma as never);
  return { guard, jwt, prisma };
}

describe('JwtAuthGuard account/session enforcement', () => {
  it('rejects a validly signed token for a frozen account', async () => {
    const { guard } = makeGuard({ id: 'user-1', role: UserRole.CUSTOMER, status: UserStatus.FROZEN, sessionsRevokedAt: null });
    await expect(guard.canActivate(context({}))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an access token issued before force logout', async () => {
    const { guard } = makeGuard({ id: 'user-1', role: UserRole.CUSTOMER, status: UserStatus.ACTIVE, sessionsRevokedAt: new Date(101_000) });
    await expect(guard.canActivate(context({}))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an access token whose integer iat equals the revocation second', async () => {
    const { guard } = makeGuard({ id: 'user-1', role: UserRole.CUSTOMER, status: UserStatus.ACTIVE, sessionsRevokedAt: new Date(100_999) });
    await expect(guard.canActivate(context({}))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('uses the current database role instead of a stale token role', async () => {
    const request: Record<string, unknown> = {};
    const { guard } = makeGuard({ id: 'user-1', role: UserRole.CUSTOMER, status: UserStatus.ACTIVE, sessionsRevokedAt: null }, { sub: 'user-1', role: UserRole.ADMIN, iat: 100 });
    await expect(guard.canActivate(context(request))).resolves.toBe(true);
    expect(request.user).toEqual({ userId: 'user-1', email: 'user@example.com', role: UserRole.CUSTOMER });
  });
});
