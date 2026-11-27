import { AdminOpsService, toCsv } from './admin-ops.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
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
      prisma as never, {} as never, { create: jest.fn().mockResolvedValue(undefined) } as never, {} as never,
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

  it('blocks an ordinary admin from revoking staff access before reading the target', async () => {
    const ordinaryAdmin = { id: 'ordinary-id', email: 'ordinary@example.test', role: UserRole.ADMIN };
    const { service, prisma } = makeService(ordinaryAdmin);
    await expect(service.revokeStaffAccess(
      ordinaryAdmin.id, { adminId: 'admin-id', adminEmail: 'admin@example.test' }, 'staff access removal',
    )).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('allows the Super Admin to revoke a support account and invalidate its sessions', async () => {
    const support = { id: 'support-id', email: 'support@example.test', role: UserRole.SUPPORT, status: 'ACTIVE' };
    const { service, prisma } = makeService(support);
    await service.revokeStaffAccess(
      support.id, { adminId: 'root-id', adminEmail: configuredEmail }, 'staff access removal',
    );
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: support.id },
      data: expect.objectContaining({ status: 'FROZEN', sessionsRevokedAt: expect.any(Date) }),
    }));
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: support.id, revokedAt: null },
    }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        actorId: 'root-id',
        entityType: 'User',
        entityId: support.id,
        reason: 'staff access removal',
        metadata: { action: 'staff.revoke' },
      }),
    }));
  });

  it('never allows the configured Super Admin to be revoked', async () => {
    const superAdmin = { id: 'root-id', email: configuredEmail, role: UserRole.ADMIN, status: 'ACTIVE' };
    const { service, prisma } = makeService(superAdmin);
    await expect(service.revokeStaffAccess(
      superAdmin.id, { adminId: 'root-id', adminEmail: configuredEmail }, 'staff access removal',
    )).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it('does not revoke customer or closed accounts through the staff endpoint', async () => {
    const actor = { adminId: 'root-id', adminEmail: configuredEmail };
    const customer = { id: 'customer-id', email: 'customer@example.test', role: UserRole.CUSTOMER, status: 'ACTIVE' };
    const { service: customerService, prisma: customerPrisma } = makeService(customer);
    await expect(customerService.revokeStaffAccess(customer.id, actor, 'staff access removal'))
      .rejects.toThrow('Only admin or support staff accounts can be revoked here');
    expect(customerPrisma.user.update).not.toHaveBeenCalled();

    const closed = { id: 'closed-id', email: 'closed@example.test', role: UserRole.SUPPORT, status: 'CLOSED' };
    const { service: closedService, prisma: closedPrisma } = makeService(closed);
    await expect(closedService.revokeStaffAccess(closed.id, actor, 'staff access removal'))
      .rejects.toThrow('A closed staff account cannot be revoked from this screen');
    expect(closedPrisma.user.update).not.toHaveBeenCalled();
  });
});

describe('AdminOpsService wallet narration and audit', () => {
  function makeAdjustmentService() {
    const prisma = {
      walletAccount: { findUnique: jest.fn().mockResolvedValue({ id: 'wallet-1', balance: '1000.00' }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const ledger = { credit: jest.fn().mockResolvedValue({ entryId: 'entry-1', balanceAfter: '1100.00' }) };
    const settings = { effectiveFulfillmentMode: jest.fn().mockResolvedValue('live') };
    const service = new AdminOpsService(
      prisma as never, ledger as never, {} as never, {} as never, settings as never, {} as never,
      { isConfiguredSuperAdmin: () => false } as never,
    );
    return { service, prisma, ledger };
  }

  it('uses the reviewed customer narration as immutable ledger and audit data', async () => {
    const { service, prisma, ledger } = makeAdjustmentService();
    const idempotencyKey = 'wallet-adjustment-123456';
    await service.creditWallet(
      'customer-1', 100, 'Approved customer goodwill credit', '  Goodwill adjustment  ',
      { adminId: 'admin-1', ipAddress: '127.0.0.1' }, idempotencyKey,
    );
    expect(ledger.credit).toHaveBeenCalledWith(expect.objectContaining({
      narrative: 'Goodwill adjustment', referenceId: idempotencyKey, adminId: 'admin-1',
    }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        actorId: 'admin-1', reason: 'Approved customer goodwill credit',
        metadata: expect.objectContaining({ narration: 'Goodwill adjustment', idempotencyKey, entryId: 'entry-1' }),
      }),
    }));
  });

  it('rejects empty and overlong narration before any financial ledger operation', async () => {
    const { service, prisma, ledger } = makeAdjustmentService();
    const actor = { adminId: 'admin-1' };
    await expect(service.creditWallet('customer-1', 100, 'Approved adjustment', '  ', actor, 'wallet-adjustment-123456'))
      .rejects.toBeInstanceOf(BadRequestException);
    await expect(service.creditWallet('customer-1', 100, 'Approved adjustment', 'x'.repeat(161), actor, 'wallet-adjustment-123456'))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(ledger.credit).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});
