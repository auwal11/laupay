import { VtpassVtuProvider } from './vtpass-vtu.provider';

/**
 * Regression coverage for the airtime network mapping. The provider
 * previously hardcoded `serviceID: 'mtn'`, which would have sent every
 * non-MTN top-up to the wrong VTpass service.
 */
describe('VtpassVtuProvider network→serviceID mapping', () => {
  const config = {
    vtpassApiKey: 'api-key',
    vtpassSecretKey: 'secret-key',
    vtpassBaseUrl: 'https://sandbox.vtpass.com',
  } as any;

  const originalFetch = global.fetch;
  let calls: Array<{ url: string; body: any }>;

  beforeEach(() => {
    calls = [];
    (global as any).fetch = jest.fn(async (url: string, init: { body?: string }) => {
      calls.push({ url, body: init?.body ? JSON.parse(init.body) : undefined });
      return {
        ok: true,
        json: async () => ({
          code: '000',
          content: { transactions: { transactionId: 'VT-1', status: 'delivered' } },
        }),
      } as any;
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it.each([
    ['MTN', 'mtn'],
    ['AIRTEL', 'airtel'],
    ['GLO', 'glo'],
    ['9MOBILE', 'etisalat'],
  ])('maps airtime network %s to serviceID %s', async (network, expected) => {
    const provider = new VtpassVtuProvider(config);
    const result = await provider.purchaseAirtime({
      network,
      phoneNumber: '08030000000',
      amount: 100,
      idempotencyKey: `airtime-${network}`,
    });

    expect(result.status).toBe('SUCCESS');
    expect(calls[0].body.request_id).toBeTruthy();
    expect(calls[0].body.serviceID).toBe(expected);
    expect(calls[0].body.variation_code).toBe(expected);
    expect(calls[0].body.billersCode).toBe('08030000000');
  });

  it('maps a data purchase to the "<network>-data" service with the 9mobile alias', async () => {
    const provider = new VtpassVtuProvider(config);
    await provider.purchaseData({
      network: '9MOBILE',
      phoneNumber: '08030000000',
      planCode: 'etisalat-data-1gb',
      idempotencyKey: 'data-1',
    });

    expect(calls[0].body.serviceID).toBe('etisalat-data');
    expect(calls[0].body.variation_code).toBe('etisalat-data-1gb');
  });

  it('never sends the hardcoded mtn service for a non-MTN network', async () => {
    const provider = new VtpassVtuProvider(config);
    await provider.purchaseAirtime({
      network: 'GLO',
      phoneNumber: '08030000000',
      amount: 100,
      idempotencyKey: 'glo-1',
    });
    expect(calls[0].body.serviceID).not.toBe('mtn');
  });

  it('stores the request_id as providerReference and re-queries via /api/requery', async () => {
    const provider = new VtpassVtuProvider(config);
    const result = await provider.purchaseAirtime({
      network: 'MTN',
      phoneNumber: '08030000000',
      amount: 50,
      idempotencyKey: 'order-x',
    });

    // requestIdFor strips non-alphanumerics from the idempotency key.
    expect(result.providerReference).toBe('orderx');

    calls.length = 0;
    await provider.verifyTransaction(result.providerReference);

    const requery = calls.find((c) => c.url.endsWith('/api/requery'));
    expect(requery).toBeDefined();
    expect(requery?.body.request_id).toBe('orderx');
    // The broken `/api/re-query` route must never be called again.
    expect(calls.some((c) => c.url.includes('/api/re-query'))).toBe(false);
  });
});
