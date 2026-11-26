import { ForbiddenException } from '@nestjs/common';
import { SecurityService } from './security.service';

describe('SecurityService PIN lockout serialization', () => {
  function makeService() {
    const record: any = {
      userId: 'user-1',
      pinHash: 'stored-hash',
      failedPinAttempts: 0,
      pinLockedUntil: null,
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      userSecurity: {
        findUnique: jest.fn().mockImplementation(async () => ({ ...record })),
        update: jest.fn().mockImplementation(async ({ data }: any) => {
          Object.assign(record, data);
          return { ...record };
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (db: unknown) => Promise<unknown>) => callback(tx)),
    };
    const passwordHasher = { verify: jest.fn().mockResolvedValue(false), hash: jest.fn() };
    const service = new SecurityService(prisma as never, passwordHasher as never);
    return { service, prisma, tx, record, passwordHasher };
  }

  it('locks on the fifth failed PIN and does not verify further attempts while locked', async () => {
    const { service, tx, record, passwordHasher } = makeService();

    for (let attempt = 1; attempt <= 4; attempt++) {
      await expect(service.verifyPin('user-1', '0000')).rejects.toBeInstanceOf(ForbiddenException);
      expect(record.failedPinAttempts).toBe(attempt);
    }
    await expect(service.verifyPin('user-1', '0000')).rejects.toMatchObject({ status: 403 });

    expect(record.failedPinAttempts).toBe(5);
    expect(record.pinLockedUntil).toBeInstanceOf(Date);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(5);
    await expect(service.verifyPin('user-1', '1234')).rejects.toBeInstanceOf(ForbiddenException);
    expect(passwordHasher.verify).toHaveBeenCalledTimes(5);
  });

  it('uses a database row lock before reading the mutable failure counter', async () => {
    const { service, tx } = makeService();
    await expect(service.verifyPin('user-1', '0000')).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.$queryRaw).toHaveBeenCalled();
  });

  it('does not hash or persist a replacement PIN until the current PIN is verified', async () => {
    const { service, tx, record, passwordHasher } = makeService();
    passwordHasher.hash.mockResolvedValue('replacement-hash');

    await expect(service.changePin('user-1', 'wrong-current', '1234')).rejects.toBeInstanceOf(ForbiddenException);
    expect(passwordHasher.hash).not.toHaveBeenCalled();
    expect(record.pinHash).toBe('stored-hash');
    expect(tx.userSecurity.update).toHaveBeenCalledTimes(1);
    expect(tx.userSecurity.update).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: { failedPinAttempts: 1, pinLockedUntil: null },
    });

    passwordHasher.verify.mockResolvedValue(true);
    await expect(service.changePin('user-1', 'correct-current', '1234')).resolves.toEqual({ hasPin: true });
    expect(passwordHasher.hash).toHaveBeenCalledWith('1234');
    expect(record.pinHash).toBe('replacement-hash');
    expect(tx.userSecurity.update).toHaveBeenCalledTimes(2);
    expect(tx.userSecurity.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ pinHash: 'replacement-hash', failedPinAttempts: 0, pinLockedUntil: null }),
    }));
  });
});
