import { Prisma, UserRole, WalletOwnerType } from '@prisma/client';
import { createHash } from 'crypto';
import { AuthService } from './auth.service';

function registrationService(existingBy?: 'email' | 'phone' | 'race') {
  const transaction = {
    user: { create: jest.fn().mockResolvedValue({ id: 'new-user', email: 'person@laupay.test' }) },
    walletAccount: { create: jest.fn().mockResolvedValue({}) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    user: {
      findUnique: jest.fn(async ({ where }: any) => {
        if (existingBy === 'email' && where.email) return { id: 'existing-user' };
        if (existingBy === 'phone' && where.phone) return { id: 'existing-user' };
        return null;
      }),
    },
    $transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
      if (existingBy === 'race') {
        throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        });
      }
      return callback(transaction);
    }),
  };
  const otp = {
    assertRegisterAllowed: jest.fn().mockResolvedValue(undefined),
    issue: jest.fn().mockResolvedValue(undefined),
  };
  const service = new AuthService(
    prisma as never,
    {} as never,
    {} as never,
    { hash: jest.fn().mockResolvedValue('password-hash') } as never,
    otp as never,
    {} as never,
    {} as never,
  );
  return { service, prisma, otp, transaction };
}

describe('AuthService registration identity privacy', () => {
  it('returns the same response body for duplicate email, duplicate phone, insert races, and a new registration', async () => {
    const dto = {
      email: 'person@laupay.test',
      password: 'Password123!',
      fullName: 'Person Example',
      phone: '08012345678',
      termsAccepted: true,
      termsVersion: 'test',
    };
    const duplicateEmail = registrationService('email');
    const duplicatePhone = registrationService('phone');
    const insertRace = registrationService('race');
    const newRegistration = registrationService();
    const responses = await Promise.all([
      duplicateEmail.service.register(dto),
      duplicatePhone.service.register(dto),
      insertRace.service.register(dto),
      newRegistration.service.register(dto),
    ]);

    expect(responses[0]).toEqual(responses[3]);
    expect(responses[1]).toEqual(responses[3]);
    expect(responses[2]).toEqual(responses[3]);
    expect(responses[3]).toEqual({
      requiresVerification: true,
      email: 'person@laupay.test',
      message: 'If an account can be created with these details, verification instructions will be sent.',
    });
    expect(duplicateEmail.otp.issue).not.toHaveBeenCalled();
    expect(duplicatePhone.otp.issue).not.toHaveBeenCalled();
    expect(newRegistration.otp.issue).toHaveBeenCalledWith('new-user');
    expect(newRegistration.transaction.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ role: UserRole.CUSTOMER }),
    }));
    expect(newRegistration.transaction.walletAccount.create).toHaveBeenCalledWith({
      data: { ownerId: 'new-user', ownerType: WalletOwnerType.USER },
    });
  });
});

describe('AuthService server-side logout', () => {
  it('atomically revokes the hashed token family including rotated descendants', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 2 });
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      refreshToken: { updateMany },
    };
    const prisma = {
      refreshToken: {
        findUnique: jest.fn().mockResolvedValue({ userId: 'user-1', sessionFamilyId: 'family-1' }),
      },
      $transaction: jest.fn(async (callback: (database: unknown) => Promise<unknown>) => callback(tx)),
    };
    const service = new AuthService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.logout('opaque-refresh-token')).resolves.toEqual({ revoked: true });
    expect(updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', sessionFamilyId: 'family-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: createHash('sha256').update('opaque-refresh-token').digest('hex') },
    });
  });
});
