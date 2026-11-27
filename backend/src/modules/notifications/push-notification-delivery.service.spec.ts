import { PushNotificationDeliveryService } from './push-notification-delivery.service';

describe('PushNotificationDeliveryService', () => {
  function makeService() {
    const prisma = {
      notificationPushDelivery: {
        update: jest.fn().mockResolvedValue({}),
      },
      notificationPushToken: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const service = new PushNotificationDeliveryService(prisma as never, {} as never);
    return { service, prisma };
  }

  it('schedules a bounded retry with the processing lock released', async () => {
    const { service, prisma } = makeService();
    await (service as any).scheduleRetry('delivery-1', 3, 'Expo push service request failed temporarily.');
    const update = prisma.notificationPushDelivery.update.mock.calls[0][0];
    expect(update.where).toEqual({ id: 'delivery-1' });
    expect(update.data.status).toBe('PENDING');
    expect(update.data.nextAttemptAt).toBeInstanceOf(Date);
    expect(update.data.lockedAt).toBeNull();
    expect(update.data.lastError).toBe('Expo push service request failed temporarily.');
  });

  it('marks an accepted Expo receipt as sent', async () => {
    const { service, prisma } = makeService();
    await (service as any).applyReceipt(
      { id: 'delivery-1', ticketedAt: new Date(), pushTokenId: 'device-1' },
      { status: 'ok' },
    );
    expect(prisma.notificationPushDelivery.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'delivery-1' },
      data: expect.objectContaining({ status: 'SENT', receiptCheckedAt: expect.any(Date), receiptDueAt: null, lockedAt: null }),
    }));
  });

  it('deactivates a token and fails the delivery when the receipt reports DeviceNotRegistered', async () => {
    const { service, prisma } = makeService();
    await (service as any).applyReceipt(
      { id: 'delivery-1', ticketedAt: new Date(), pushTokenId: 'device-1' },
      { status: 'error', details: { error: 'DeviceNotRegistered' } },
    );
    expect(prisma.notificationPushToken.updateMany).toHaveBeenCalledWith({
      where: { id: 'device-1', isActive: true },
      data: expect.objectContaining({ isActive: false, revokedAt: expect.any(Date) }),
    });
    expect(prisma.notificationPushDelivery.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'delivery-1' },
      data: expect.objectContaining({ status: 'FAILED', receiptDueAt: null, lockedAt: null }),
    }));
  });
});
