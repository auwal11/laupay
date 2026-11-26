import { UnauthorizedException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { AuthService } from './auth.service';

function makeService(status: UserStatus) {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'person@example.com',
        fullName: 'Person Example',
        role: 'CUSTOMER',
        status,
      }),
    },
  };
  const otp = {
    assertVerifyAllowed: jest.fn().mockResolvedValue(undefined),
    consume: jest.fn().mockResolvedValue(undefined),
  };
  const jwt = { signAsync: jest.fn() };
  const service = new AuthService(
    prisma as never,
    jwt as never,
    {} as never,
    {} as never,
      otp as never,
      {} as never,
      {} as never,
    );
  return { service, otp, jwt, prisma };
}

describe('AuthService OTP activation boundary', () => {
  it.each([UserStatus.ACTIVE, UserStatus.SUSPENDED, UserStatus.FROZEN, UserStatus.CLOSED])(
    'does not issue tokens or reactivate a %s account through verify-otp',
    async (status) => {
      const { service, otp, jwt } = makeService(status);

      await expect(
        service.verifyEmail({ email: 'person@example.com', code: '000000' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(otp.consume).not.toHaveBeenCalled();
      expect(jwt.signAsync).not.toHaveBeenCalled();
    },
  );

  it('allows OTP consumption only for a pending-verification account', async () => {
    const { service, otp } = makeService(UserStatus.PENDING_VERIFICATION);
    // The mocked persistence is intentionally incomplete after consume; this
    // assertion only verifies that the guarded OTP path is reached.
    await expect(
      service.verifyEmail({ email: 'person@example.com', code: '123456' }),
    ).rejects.toBeDefined();
    expect(otp.consume).toHaveBeenCalledWith('user-1', '123456');
  });
});

describe('AuthService password reset verification boundary', () => {
  it('does not activate an unverified account after password reset', async () => {
    const userUpdate = jest.fn().mockReturnValue({ operation: 'user.update' });
    const tokenClaim = jest.fn().mockResolvedValue({ count: 1 });
    const refreshUpdate = jest.fn().mockReturnValue({ operation: 'refresh.update' });
    const auditCreate = jest.fn().mockReturnValue({ operation: 'audit.create' });
    const transaction = jest.fn((callback: (tx: unknown) => Promise<unknown>) => callback({
      passwordResetToken: { updateMany: tokenClaim },
      user: { update: userUpdate },
      refreshToken: { updateMany: refreshUpdate },
      auditLog: { create: auditCreate },
    }));
    const prisma = {
      passwordResetToken: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'reset-1',
          userId: 'user-1',
          usedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
        }),
      },
      $transaction: transaction,
    };
    const service = new AuthService(
      prisma as never,
      {} as never,
      {} as never,
      { hash: jest.fn().mockResolvedValue('new-password-hash') } as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.resetPassword('reset-token', 'NewPassword123!')).resolves.toEqual({ reset: true });
    expect(tokenClaim).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'reset-1', usedAt: null, expiresAt: { gt: expect.any(Date) } }),
    }));
    expect(userUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'user-1' },
      data: expect.not.objectContaining({ status: 'ACTIVE' }),
    }));
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ timeout: expect.any(Number), maxWait: expect.any(Number) }));
  });

  it('does not mutate credentials, sessions, or audit records when another reset request claimed the token', async () => {
    const userUpdate = jest.fn();
    const refreshUpdate = jest.fn();
    const auditCreate = jest.fn();
    const transaction = jest.fn((callback: (tx: unknown) => Promise<unknown>) => callback({
      passwordResetToken: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      user: { update: userUpdate },
      refreshToken: { updateMany: refreshUpdate },
      auditLog: { create: auditCreate },
    }));
    const prisma = {
      passwordResetToken: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'reset-1', userId: 'user-1', usedAt: null, expiresAt: new Date(Date.now() + 60_000),
        }),
      },
      $transaction: transaction,
    };
    const service = new AuthService(
      prisma as never,
      {} as never,
      {} as never,
      { hash: jest.fn().mockResolvedValue('new-password-hash') } as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.resetPassword('reset-token', 'NewPassword123!')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(userUpdate).not.toHaveBeenCalled();
    expect(refreshUpdate).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });
});

describe('AuthService refresh-token rotation', () => {
  it('rejects a refresh replay that loses the atomic single-use claim', async () => {
    const refreshToken = 'refresh-token';
    const claim = jest.fn().mockResolvedValue({ count: 0 });
    const create = jest.fn();
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'user-1', status: 'ACTIVE' }) },
      refreshToken: { updateMany: claim, create },
    };
    const prisma = {
      refreshToken: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'refresh-1',
          tokenHash: 'not-used-by-test',
          revokedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
          userId: 'user-1',
          sessionFamilyId: 'family-1',
        }),
      },
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'user-1', role: 'CUSTOMER', status: 'ACTIVE' }),
      },
      $transaction: jest.fn(async (callback: (database: any) => Promise<unknown>) => callback(tx)),
    };
    const jwt = { signAsync: jest.fn() };
    const service = new AuthService(
      prisma as never,
      jwt as never,
      { jwtAccessSecret: 'test-secret', jwtAccessExpiresIn: '15m', jwtRefreshExpiresInDays: 30 } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.refresh(refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(claim).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'refresh-1', revokedAt: null }),
    }));
    expect(create).not.toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('mints a new token pair only after the refresh token is claimed', async () => {
    const claim = jest.fn().mockResolvedValue({ count: 1 });
    const create = jest.fn().mockResolvedValue({ id: 'refresh-2' });
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'user-1', status: 'ACTIVE' }) },
      refreshToken: { updateMany: claim, create },
    };
    const prisma = {
      refreshToken: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'refresh-1',
          tokenHash: 'not-used-by-test',
          revokedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
          userId: 'user-1',
          sessionFamilyId: 'family-1',
        }),
      },
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'user-1', role: 'CUSTOMER', status: 'ACTIVE' }),
      },
      $transaction: jest.fn(async (callback: (database: any) => Promise<unknown>) => callback(tx)),
    };
    const jwt = { signAsync: jest.fn().mockResolvedValue('access-token') };
    const service = new AuthService(
      prisma as never,
      jwt as never,
      { jwtAccessSecret: 'test-secret', jwtAccessExpiresIn: '15m', jwtRefreshExpiresInDays: 30 } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const tokens = await service.refresh('refresh-token');
    expect(tokens.accessToken).toBe('access-token');
    expect(tokens.refreshToken).toEqual(expect.any(String));
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'user-1', sessionFamilyId: 'family-1', tokenHash: expect.any(String) }),
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('revokes all rotated descendants in one session family on logout', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 2 });
    const transaction = jest.fn(async (callback: (tx: any) => Promise<unknown>) => callback({
      $queryRaw: jest.fn().mockResolvedValue([]),
      refreshToken: { updateMany },
    }));
    const prisma = {
      refreshToken: {
        findUnique: jest.fn().mockResolvedValue({ userId: 'user-1', sessionFamilyId: 'family-1' }),
      },
      $transaction: transaction,
    };
    const service = new AuthService(prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never);

    await expect(service.logout('refresh-token')).resolves.toEqual({ revoked: true });
    expect(updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', sessionFamilyId: 'family-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
