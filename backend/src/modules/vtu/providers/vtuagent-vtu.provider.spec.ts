import { VtuAgentVtuProvider } from './vtuagent-vtu.provider';

describe('VtuAgentVtuProvider', () => {
  const config = {
    vtuAgentApiKey: 'agent-key',
    vtuAgentBaseUrl: 'https://api.vtuagent.com/v1',
    vtuProviderTimeoutMs: 5000,
  } as any;
  const originalFetch = global.fetch;

  afterEach(() => { global.fetch = originalFetch; });

  it('uses the documented airtime request and maps successful response', async () => {
    let request: any;
    (global as any).fetch = jest.fn(async (_url: string, init: any) => {
      request = { url: _url, init, body: JSON.parse(init.body) };
      return { ok: true, status: 200, json: async () => ({ status: 'successful', reference: 'ref-1' }) };
    });
    const result = await new VtuAgentVtuProvider(config).purchaseAirtime({
      network: '9MOBILE', phoneNumber: '08030000000', amount: 100, idempotencyKey: 'ref-1',
    });
    expect(request.url).toBe('https://api.vtuagent.com/v1/airtime/purchase');
    expect(request.init.headers.Authorization).toBe('Bearer agent-key');
    expect(request.body).toEqual({ network: 'etisalat', phone: '08030000000', amount: 100, request_ref: 'ref-1' });
    expect(result.status).toBe('SUCCESS');
  });

  it('maps pending and failed provider responses without declaring success', async () => {
    (global as any).fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, status: 202, json: async () => ({ status: 'pending', reference: 'ref-2' }) })
      .mockResolvedValueOnce({ ok: false, status: 424, json: async () => ({ status: 'failed', reference: 'ref-3' }) });
    const provider = new VtuAgentVtuProvider(config);
    await expect(provider.purchaseAirtime({ network: 'MTN', phoneNumber: '08030000000', amount: 100, idempotencyKey: 'ref-2' })).resolves.toMatchObject({ status: 'PROCESSING' });
    await expect(provider.purchaseAirtime({ network: 'MTN', phoneNumber: '08030000000', amount: 100, idempotencyKey: 'ref-3' })).resolves.toMatchObject({ status: 'FAILED' });
  });

  it('maps only plans returned by the provider catalog', async () => {
    (global as any).fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ data: [
      { plan_id: 'mtn_1gb_30d', network: 'MTN', plan_name: 'MTN 1GB', price: '270', validity: '30 days', is_active: true },
      { plan_id: 'glo_2gb', network: 'GLO', plan_name: 'Glo 2GB', price: '500', validity: '30 days', is_active: true },
    ] }) }));
    await expect(new VtuAgentVtuProvider(config).listDataPlans('MTN')).resolves.toEqual([
      { externalCode: 'mtn_1gb_30d', label: 'MTN 1GB', costNaira: 270, validityDays: 30 },
    ]);
  });
});
