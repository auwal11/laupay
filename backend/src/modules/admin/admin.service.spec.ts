import { ForbiddenException } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import { AdminService } from './admin.service';

describe('AdminService.listStaffAccounts', () => {
  const staff = [
    {
      id: 'root-id', email: 'root@example.test', fullName: 'Super Admin',
      role: UserRole.ADMIN, status: UserStatus.ACTIVE, createdAt: new Date(), updatedAt: new Date(),
    },
    {
      id: 'support-id', email: 'support@example.test', fullName: 'Support User',
      role: UserRole.SUPPORT, status: UserStatus.ACTIVE, createdAt: new Date(), updatedAt: new Date(),
    },
  ];

  function makeService(isSuperAdmin: boolean) {
    const prisma = {
      user: {
        count: jest.fn().mockResolvedValue(staff.length),
        findMany: jest.fn().mockResolvedValue(staff),
      },
    };
    const config = {
      isConfiguredSuperAdmin: (id?: string) => isSuperAdmin && id === 'root-id',
    };
    const service = new AdminService(
      prisma as never, config as never, {} as never, {} as never,
      {} as never, {} as never, {} as never,
    );
    return { service, prisma };
  }

  it('returns all staff roles and marks the configured Super Admin as protected', async () => {
    const { service, prisma } = makeService(true);
    const result = await service.listStaffAccounts('root-id', 'root@example.test', { page: 1, pageSize: 20 });

    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { role: { in: [UserRole.ADMIN, UserRole.SUPPORT, UserRole.FINANCE, UserRole.VIEWER] } },
      select: expect.not.objectContaining({ passwordHash: true }),
    }));
    expect(result.items).toEqual([
      expect.objectContaining({ id: 'root-id', isSuperAdmin: true }),
      expect.objectContaining({ id: 'support-id', isSuperAdmin: false }),
    ]);
  });

  it('denies a non-Super Admin before querying any staff records', async () => {
    const { service, prisma } = makeService(false);
    await expect(service.listStaffAccounts('ordinary-id', 'admin@example.test', {}))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.count).not.toHaveBeenCalled();
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });
});
