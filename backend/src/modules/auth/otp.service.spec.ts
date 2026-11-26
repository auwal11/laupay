import { OtpService } from './otp.service';

describe('OtpService security controls', () => {
  it('uses a secret HMAC pepper so a database-only dump cannot verify OTP guesses', () => {
    const makeService = (otpPepper: string) => new OtpService({} as never, { otpPepper } as never, {} as never);
    const first = makeService('private-pepper-A'.padEnd(40, 'a')) as any;
    const second = makeService('private-pepper-B'.padEnd(40, 'b')) as any;

    expect(first.hash('123456')).not.toBe(second.hash('123456'));
    expect(first.hash('123456')).toBe(first.hash('123456'));
  });

  it('invalidates an OTP after five failed verification attempts', async () => {
    const otp = {
      id: 'otp-1',
      userId: 'user-1',
      purpose: 'REGISTRATION',
      codeHash: 'not-the-submitted-code',
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      lockedUntil: null,
      attempts: 0,
      maxAttempts: 5,
    };
    const prisma = {
      emailOtp: {
        findFirst: jest.fn().mockImplementation(async () => ({ ...otp })),
        updateMany: jest.fn().mockImplementation(async ({ data }: any) => {
          if (data.attempts?.increment) otp.attempts += data.attempts.increment;
          return { count: 1 };
        }),
        update: jest.fn().mockResolvedValue(otp),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = new OtpService(prisma as never, { otpPepper: 'unit-test-pepper-that-is-long-enough-123456' } as never, {} as never);

    await expect(service.consume('user-1', '000000')).rejects.toMatchObject({ status: 401 });
    await expect(service.consume('user-1', '000000')).rejects.toMatchObject({ status: 401 });
    await expect(service.consume('user-1', '000000')).rejects.toMatchObject({ status: 401 });
    await expect(service.consume('user-1', '000000')).rejects.toMatchObject({ status: 401 });
    await expect(service.consume('user-1', '000000')).rejects.toMatchObject({ status: 429 });
    expect(prisma.emailOtp.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'otp-1' },
      data: expect.objectContaining({ consumedAt: expect.any(Date), lockedUntil: expect.any(Date) }),
    }));
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(5);
  });

  it('enforces the resend cooldown before issuing another code', async () => {
    const records = new Map<string, any>();
    const prisma = {
      otpRateLimit: {
        findUnique: jest.fn(async ({ where }: any) => records.get(where.key) ?? null),
        upsert: jest.fn(async ({ where, create }: any) => {
          records.set(where.key, { ...create });
          return create;
        }),
        update: jest.fn(async ({ where, data }: any) => {
          const current = records.get(where.key);
          const next = { ...current, ...data, count: typeof data.count === 'object' ? current.count + data.count.increment : data.count };
          records.set(where.key, next);
          return next;
        }),
      },
    };
    const service = new OtpService(prisma as never, {} as never, {} as never);

    await service.assertResendAllowed('person@example.com', '127.0.0.1');
    await expect(service.assertResendAllowed('person@example.com', '127.0.0.1')).rejects.toMatchObject({ status: 429 });
  });
});
