import { ExpoPushHttpError, ExpoPushProvider } from './expo-push.provider';

describe('ExpoPushProvider', () => {
  afterEach(() => jest.restoreAllMocks());

  it('sends a privacy-safe payload and returns an Expo ticket without logging token data', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: { status: 'ok', id: 'ticket-1' } }), { status: 200 }),
    );
    const provider = new ExpoPushProvider();
    const result = await provider.send('ExpoPushToken[abcdefghijklmnopqrstu]', 'notification-1');

    expect(result).toEqual({ status: 'ok', id: 'ticket-1' });
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://exp.host/--/api/v2/push/send');
    const payload = JSON.parse(String(init?.body));
    expect(payload).toMatchObject({
      title: 'LAUPAY',
      body: expect.any(String),
      data: { notificationId: 'notification-1', route: '/notifications' },
      channelId: 'transaction_updates',
      priority: 'high',
    });
    expect(payload.body).not.toMatch(/NGN|\d+\.\d{2}|transaction reference/i);
    expect(payload.to).toBe('ExpoPushToken[abcdefghijklmnopqrstu]');
  });

  it('retrieves receipts by ticket ID', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: { 'ticket-1': { status: 'ok' } } }), { status: 200 }),
    );
    const provider = new ExpoPushProvider();
    await expect(provider.getReceipts(['ticket-1'])).resolves.toEqual({ 'ticket-1': { status: 'ok' } });
  });

  it('exposes HTTP status only for retry classification and does not include provider response text', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('secret response detail', { status: 429 }));
    const provider = new ExpoPushProvider();
    await expect(provider.send('ExpoPushToken[abcdefghijklmnopqrstu]', 'notification-1'))
      .rejects.toEqual(expect.objectContaining({ name: 'ExpoPushHttpError', status: 429 }));
    try {
      await provider.send('ExpoPushToken[abcdefghijklmnopqrstu]', 'notification-1');
    } catch (error) {
      expect(error).toBeInstanceOf(ExpoPushHttpError);
      expect((error as Error).message).not.toContain('secret response detail');
    }
  });
});
