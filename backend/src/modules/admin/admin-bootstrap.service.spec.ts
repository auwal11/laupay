import { UserRole, UserStatus } from '@prisma/client';
import { AdminBootstrapService } from './admin-bootstrap.service';

function makeService(options: {
  adminEmail?: string;
  adminPassword?: string;
  superAdminEmails?: string[];
  existingUsers?: Record<string, Record<string, unknown>>;
} = {}) {
  const createdUsers: Array<{ data: Record<string, unknown> }> = [];
  const existingUsers = options.existingUsers ?? {};
  const user = {
    findUnique: jest.fn().mockImplementation(async ({ where }) => existingUsers[where.email] ?? null),
    update: jest.fn().mockResolvedValue({}),
    create: jest.fn().mockImplementation(async (args) => {
      createdUsers.push(args);
      return { id: `new-user-${createdUsers.length}`, ...args.data };
    }),
  };
  const prisma = {
    user,
    walletAccount: {
      findUnique: jest.fn().mockResolvedValue({ id: 'wallet-id' }),
      create: jest.fn().mockResolvedValue({ id: 'wallet-id' }),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn().mockImplementation((callback) => callback(prisma)),
  };
  const allowlisted = new Set((options.superAdminEmails ?? []).map((email) => email.trim().toLowerCase()));
  const config = {
    adminBootstrapEmail: options.adminEmail ?? '',
    adminBootstrapPassword: options.adminPassword ?? '',
    adminBootstrapName: 'LAUPAY Admin',
    superAdminEmails: allowlisted,
    isConfiguredSuperAdmin: (_id?: string, email?: string) =>
      Boolean(email && allowlisted.has(email.trim().toLowerCase())),
  };
  const passwordHasher = { hash: jest.fn().mockResolvedValue('argon-hash') };
  const auth = { forgotPassword: jest.fn().mockResolvedValue({ sent: true }) };
  const service = new AdminBootstrapService(
    prisma as never, config as never, passwordHasher as never, auth as never,
  );
  return { service, prisma, passwordHasher, auth, createdUsers };
}

describe('AdminBootstrapService', () => {
  it('creates a separate Super Admin account and sends its reset email, not the regular admin email', async () => {
    const existingAdmin = {
      id: 'existing-admin-id',
      email: 'admin@example.test',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    };
    const { service, prisma, passwordHasher, auth, createdUsers } = makeService({
      adminEmail: 'admin@example.test',
      adminPassword: 'existing-admin-password',
      superAdminEmails: ['root@example.test'],
      existingUsers: { 'admin@example.test': existingAdmin },
    });

    await service.onApplicationBootstrap();

    expect(createdUsers).toHaveLength(1);
    expect(createdUsers[0].data).toEqual(expect.objectContaining({
      email: 'root@example.test',
      fullName: 'LAUPAY Super Admin',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      mustChangePassword: true,
      passwordHash: 'argon-hash',
    }));
    const generatedPassword = passwordHasher.hash.mock.calls[0][0];
    expect(generatedPassword).toMatch(/^[A-Za-z0-9_-]{64}$/);
    expect(auth.forgotPassword).toHaveBeenCalledTimes(1);
    expect(auth.forgotPassword).toHaveBeenCalledWith('root@example.test');
    expect(auth.forgotPassword).not.toHaveBeenCalledWith('admin@example.test');
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.walletAccount.create).toHaveBeenCalledWith({
      data: { ownerId: 'new-user-1', ownerType: 'USER' },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: 'new-user-1',
        entityType: 'User',
        entityId: 'new-user-1',
        metadata: { bootstrap: true, superAdmin: true },
      }),
    });
  });

  it('does not create an account for ADMIN_EMAIL alone when no password or allowlist exists', async () => {
    const { service, prisma, passwordHasher } = makeService({
      adminEmail: 'admin@example.test',
      superAdminEmails: [],
    });

    await service.onApplicationBootstrap();

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(passwordHasher.hash).not.toHaveBeenCalled();
  });

  it('does not replace the password or send another reset email for an existing active Super Admin', async () => {
    const existingSuperAdmin = {
      id: 'existing-superadmin-id',
      email: 'root@example.test',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    };
    const { service, prisma, passwordHasher, auth } = makeService({
      superAdminEmails: ['root@example.test'],
      existingUsers: { 'root@example.test': existingSuperAdmin },
    });

    await service.onApplicationBootstrap();

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(passwordHasher.hash).not.toHaveBeenCalled();
    expect(auth.forgotPassword).not.toHaveBeenCalled();
    expect(prisma.walletAccount.create).not.toHaveBeenCalled();
  });

  it('restores ADMIN/ACTIVE status for an existing allowlisted account without resetting its password', async () => {
    const existing = {
      id: 'existing-id',
      email: 'root@example.test',
      role: UserRole.CUSTOMER,
      status: UserStatus.FROZEN,
    };
    const { service, prisma, passwordHasher, auth } = makeService({
      superAdminEmails: ['root@example.test'],
      existingUsers: { 'root@example.test': existing },
    });

    await service.onApplicationBootstrap();

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'existing-id' },
      data: { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
    });
    expect(passwordHasher.hash).not.toHaveBeenCalled();
    expect(auth.forgotPassword).not.toHaveBeenCalled();
  });
});
