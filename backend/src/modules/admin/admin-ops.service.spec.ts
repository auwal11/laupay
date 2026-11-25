import { AdminOpsService, toCsv } from './admin-ops.service';
import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

describe('admin CSV exports', () => {
  it('neutralizes spreadsheet formula injection in user-controlled cells', () => {
    expect(toCsv([
      { name: '=HYPERLINK("https://attacker.invalid")', note: '+SUM(1,1)', phone: '-1234567890', tag: '@cmd' },
    ], ['name', 'note', 'phone', 'tag'])).toBe(`name,note,phone,tag
"'=HYPERLINK(""https://attacker.invalid"")","'+SUM(1,1)",'-1234567890,'@cmd`);
  });
});

describe('AdminOpsService.userDetail response allowlist', () => {
  it('never selects or serializes user authentication secrets', async () => {
    const user = {
      id: 'user-1',
      email: 'person@example.test',
      phone: null,
      fullName: 'Test User',
      profilePhotoUrl: null,
      role: 'CUSTOMER',
      status: 'ACTIVE',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      emailVerifiedAt: null,
      phoneVerifiedAt: null,
      lastLoginAt: null,
      frozenReason: null,
      twoFactorEnabled: false,
      mustChangePassword: false,
      walletAccount: { id: 'wallet-1', balance: '0', currency: 'NGN', status: 'ACTIVE', version: 0 },
      security: { pinSetAt: null, pinLockedUntil: null, failedPinAttempts: 0, pinHash: 'PIN_HASH_SENTINEL' },
      agentProfile: null,
    };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(user) },
      order: { findMany: jest.fn().mockResolvedValue([]) },
      ledgerEntry: { findMany: jest.fn().mockResolvedValue([]) },
      transactionDispute: { findMany: jest.fn().mockResolvedValue([]) },
      adminNote: { findMany: jest.fn().mockResolvedValue([]) },
      riskEvent: { findMany: jest.fn().mockResolvedValue([]) },
      refreshToken: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new AdminOpsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const detail = await service.userDetail('user-1');
    const serialized = JSON.stringify(detail);
    const requestedFields = Object.keys(prisma.user.findUnique.mock.calls[0][0].select);

    expect(requestedFields).not.toContain('passwordHash');
    expect(requestedFields).not.toContain('twoFactorSecret');
    expect(requestedFields).not.toContain('sessionsRevokedAt');
    expect(requestedFields).not.toContain('lastLoginIp');
    expect(serialized).not.toContain('passwordHash');
    expect(serialized).not.toContain('twoFactorSecret');
    expect(serialized).not.toContain('sessionsRevokedAt');
    expect(serialized).not.toContain('lastLoginIp');
    expect(serialized).not.toContain('PIN_HASH_SENTINEL');
    expect(detail).toEqual(expect.objectContaining({
      id: 'user-1',
      email: 'person@example.test',
      walletAccount: expect.objectContaining({ id: 'wallet-1' }),
      hasPin: true,
      failedPinAttempts: 0,
      sessions: [],
    }));
  });
});

describe('AdminOpsService Super Admin protections', () => {
  const configuredEmail = 'root@example.test';
  const config = {
    isConfiguredSuperAdmin: (id?: string, email?: string) =>
      id === 'root-id' || email?.trim().toLowerCase() === configuredEmail,
  };

  function makeService(user: Record<string, unknown>) {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(user),
        update: jest.fn().mockResolvedValue(user),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      $transaction: jest.fn().mockImplementation((ops) => Promise.all(ops)),
    };
    const service = new AdminOpsService(
      prisma as never, {} as never, { create: jest.fn() } as never, {} as never,
      {} as never, {} as never, config as never,
    );
    return { service, prisma };
  }

  it('blocks a regular admin from changing staff roles', async () => {
    const { service } = makeService({ id: 'staff-id', email: 'staff@example.test', role: UserRole.ADMIN });
    await expect(service.setRole(
      'staff-id', UserRole.SUPPORT, { adminId: 'admin-id', adminEmail: 'admin@example.test' }, 'role update',
    )).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows a Super Admin to demote an ordinary admin', async () => {
    const ordinaryAdmin = { id: 'ordinary-id', email: 'ordinary@example.test', role: UserRole.ADMIN };
    const { service, prisma } = makeService(ordinaryAdmin);
    await service.setRole(
      ordinaryAdmin.id, UserRole.SUPPORT,
      { adminId: 'root-id', adminEmail: configuredEmail }, 'revoke admin access',
    );
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: ordinaryAdmin.id },
      data: expect.objectContaining({ role: UserRole.SUPPORT }),
    }));
  });

  it('never permits changing a Super Admin role, including by another Super Admin', async () => {
    const superAdmin = { id: 'root-id', email: configuredEmail, role: UserRole.ADMIN };
    const { service, prisma } = makeService(superAdmin);
    await expect(service.setRole(
      superAdmin.id, UserRole.SUPPORT,
      { adminId: 'root-id', adminEmail: configuredEmail }, 'demotion attempt',
    )).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('cannot freeze a Super Admin identified by normalized allowlisted email', async () => {
    const superAdmin = { id: 'other-id', email: ' ROOT@EXAMPLE.TEST ', role: UserRole.ADMIN };
    const { service, prisma } = makeService(superAdmin);
    await expect(service.freezeUser(
      superAdmin.id, { adminId: 'root-id' }, 'attempted freeze',
    )).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('cannot force-logout a Super Admin', async () => {
    const superAdmin = { id: 'root-id', email: configuredEmail, role: UserRole.ADMIN };
    const { service, prisma } = makeService(superAdmin);
    await expect(service.forceLogout(
      superAdmin.id, { adminId: 'root-id' }, 'attempted logout',
    )).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('blocks an ordinary admin from force-logging out another staff account', async () => {
    const ordinaryAdmin = { id: 'ordinary-id', email: 'ordinary@example.test', role: UserRole.ADMIN };
    const { service, prisma } = makeService(ordinaryAdmin);
    await expect(service.forceLogout(
      ordinaryAdmin.id, { adminId: 'admin-id', adminEmail: 'admin@example.test' }, 'logout attempt',
    )).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
