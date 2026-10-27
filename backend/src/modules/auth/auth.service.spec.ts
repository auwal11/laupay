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
