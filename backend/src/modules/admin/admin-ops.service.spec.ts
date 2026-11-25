import { AdminOpsService, toCsv } from './admin-ops.service';

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
