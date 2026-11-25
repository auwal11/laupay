import { UserRole, UserStatus } from '@prisma/client';
import { AdminBootstrapService } from './admin-bootstrap.service';

function makeService(options: {
  email?: string;
  password?: string;
  isSuperAdmin?: boolean;
  existing?: Record<string, unknown> | null;
} = {}) {
  const createdUsers: Array<{ data: Record<string, unknown> }> = [];
  const user = {
    findUnique: jest.fn().mockResolvedValue(options.existing ?? null),
    update: jest.fn().mockResolvedValue({}),
    create: jest.fn().mockImplementation(async (args) => {
      createdUsers.push(args);
      return { id: 'new-admin-id', ...args.data };
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
  const config = {
    adminBootstrapEmail: options.email ?? '',
    adminBootstrapPassword: options.password ?? '',
    adminBootstrapName: 'LAUPAY Super Admin',
    isConfiguredSuperAdmin: (_id?: string, email?: string) =>
      Boolean(options.isSuperAdmin && email?.trim().toLowerCase() === 'root@example.test'),
  };
  const passwordHasher = { hash: jest.fn().mockResolvedValue('argon-hash') };
  const service = new AdminBootstrapService(prisma as never, config as never, passwordHasher as never);
  return { service, prisma, passwordHasher, createdUsers };
}

describe('AdminBootstrapService', () => {
  it('creates an allowlisted Super Admin with an undisclosed random password that requires reset', async () => {
    const { service, prisma, passwordHasher, createdUsers } = makeService({
      email: ' ROOT@EXAMPLE.TEST ',
      isSuperAdmin: true,
    });

    await service.onApplicationBootstrap();

    expect(passwordHasher.hash).toHaveBeenCalledTimes(1);
    const generatedPassword = passwordHasher.hash.mock.calls[0][0];
    expect(generatedPassword).toMatch(/^[A-Za-z0-9_-]{64}$/);
    expect(createdUsers[0].data).toEqual(expect.objectContaining({
      email: 'root@example.test',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      mustChangePassword: true,
      passwordHash: 'argon-hash',
    }));
    expect(prisma.walletAccount.create).toHaveBeenCalledWith({
      data: { ownerId: 'new-admin-id', ownerType: 'USER' },
    });
  });

  it('does not create an account without a password unless the email is allowlisted', async () => {
    const { service, prisma, passwordHasher } = makeService({
      email: 'not-allowlisted@example.test',
      isSuperAdmin: false,
    });

    await service.onApplicationBootstrap();

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(passwordHasher.hash).not.toHaveBeenCalled();
  });

  it('does not replace the password of an existing allowlisted account', async () => {
    const existing = {
      id: 'existing-id',
      email: 'root@example.test',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    };
    const { service, prisma, passwordHasher } = makeService({
      email: 'root@example.test',
      isSuperAdmin: true,
      existing,
    });

    await service.onApplicationBootstrap();

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(passwordHasher.hash).not.toHaveBeenCalled();
    expect(prisma.walletAccount.create).not.toHaveBeenCalled();
  });
});
