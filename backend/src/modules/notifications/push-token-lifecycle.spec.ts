import { ConflictException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

describe('push token ownership and revocation', () => {
  const token = 'ExpoPushToken[abcdefghijklmnopqrstu]';

  function makeService(existing: unknown = null) {
    const prisma = {
      notificationPushToken: {
        findUnique: jest.fn().mockResolvedValue(existing),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    return { service: new NotificationsService(prisma as never), prisma };
  }

  it('rejects an active token that belongs to a different account', async () => {
    const { service, prisma } = makeService({ id: 'device-1', userId: 'user-a', isActive: true });
    await expect(service.registerPushToken('user-b', token, 'android')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.notificationPushToken.update).not.toHaveBeenCalled();
    expect(prisma.notificationPushToken.create).not.toHaveBeenCalled();
  });

  it('reactivates a token already owned by the authenticated account', async () => {
    const { service, prisma } = makeService({ id: 'device-1', userId: 'user-a', isActive: false });
    await expect(service.registerPushToken('user-a', token, 'ios')).resolves.toEqual({ registered: true });
    expect(prisma.notificationPushToken.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'device-1' },
      data: expect.objectContaining({ userId: 'user-a', platform: 'ios', isActive: true, revokedAt: null }),
    }));
  });

  it('revokes only the matching active token owned by the authenticated account', async () => {
    const { service, prisma } = makeService();
    await expect(service.unregisterPushToken('user-a', token)).resolves.toEqual({ removed: true });
    expect(prisma.notificationPushToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-a', expoPushToken: token, isActive: true },
      data: expect.objectContaining({ isActive: false, revokedAt: expect.any(Date) }),
    });
  });
});
