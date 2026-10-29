import { CheapDataHubVtuProvider } from './cheapdatahub-vtu.provider';

describe('CheapDataHubVtuProvider', () => {
  const config = {
    cheapDataHubApiKey: 'cheap-key',
    cheapDataHubBaseUrl: 'https://www.cheapdatahub.ng/api/v1/resellers',
    cheapDataHubPlans: [{ network: 'MTN', bundleId: 12, label: '1GB 30 Days', price: 450, validityDays: 30 }],
    cheapDataHubNetworkIds: { MTN: 1 },
    vtuProviderTimeoutMs: 5000,
  } as any;
  const originalFetch = global.fetch;

  afterEach(() => { global.fetch = originalFetch; });

  it('uses the documented bearer API and configured network ID', async () => {
    let request: any;
    (global as any).fetch = jest.fn(async (_url: string, init: any) => {
      request = { url: _url, init, body: JSON.parse(init.body) };
      return { ok: true, status: 200, json: async () => ({ status: 'true', transaction_id: 449, reference: 'CDH-1' }) };
    });
    const result = await new CheapDataHubVtuProvider(config).purchaseAirtime({
      network: 'MTN', phoneNumber: '08030000000', amount: 100, idempotencyKey: 'lau-1',
    });
    expect(request.url).toBe('https://www.cheapdatahub.ng/api/v1/resellers/airtime/purchase/');
    expect(request.init.headers.Authorization).toBe('Bearer cheap-key');
    expect(request.body.provider_id).toBe(1);
    expect(result).toMatchObject({ status: 'SUCCESS', providerReference: '449' });
  });

  it('does not guess a data plan or network ID', async () => {
    await expect(new CheapDataHubVtuProvider({ ...config, cheapDataHubNetworkIds: {} } as any)
      .purchaseAirtime({ network: 'MTN', phoneNumber: '08030000000', amount: 100, idempotencyKey: 'lau-2' }))
      .resolves.toMatchObject({ status: 'UNKNOWN' });
    await expect(new CheapDataHubVtuProvider(config)
      .purchaseData({ network: 'MTN', phoneNumber: '08030000000', planCode: 'mtn-1gb', idempotencyKey: 'lau-3' }))
      .resolves.toMatchObject({ status: 'FAILED' });
  });
});
