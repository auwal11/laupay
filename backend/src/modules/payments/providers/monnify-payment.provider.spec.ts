import { MonnifyPaymentProvider } from './monnify-payment.provider';

/**
 * Regression coverage for the Monnify sandbox endpoint/field corrections:
 *  - initialize must POST /api/v1/merchant/transactions/init-transaction with
 *    `paymentReference`/`currencyCode` (the old `/api/v1/transactions/initialize`
 *    + `reference`/`currency` shape returned HTTP 405 from the real sandbox);
 *  - the stored providerReference is Monnify's transactionReference;
 *  - verify queries /api/v2/transactions/{reference}.
 */
describe('MonnifyPaymentProvider sandbox contract', () => {
  const config = {
    monnifyApiKey: 'MK_TEST_api',
    monnifySecretKey: 'MK_TEST_secret',
    monnifyBaseUrl: 'https://sandbox.monnify.com',
    monnifyContractCode: 'contract-code',
  } as any;

  const originalFetch = global.fetch;
  let calls: Array<{ url: string; body: any }>;

  beforeEach(() => {
    calls = [];
    (global as any).fetch = jest.fn(async (url: string, init?: { body?: string }) => {
      calls.push({ url, body: init?.body ? JSON.parse(init.body) : undefined });
      if (url.endsWith('/api/v1/auth/login')) {
        return { ok: true, json: async () => ({ requestSuccessful: true, responseBody: { accessToken: 'token-1' } }) } as any;
      }
      if (url.endsWith('/api/v1/merchant/transactions/init-transaction')) {
        return {
          ok: true,
          json: async () => ({
            requestSuccessful: true,
            responseBody: { checkoutUrl: 'https://sandbox.sdk.monnify.com/checkout/MNFY|1|X', transactionReference: 'MNFY|1|X' },
          }),
        } as any;
      }
      // status query
      return { ok: true, json: async () => ({ requestSuccessful: true, responseBody: { paymentStatus: 'PAID' } }) } as any;
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('initializes via the correct endpoint and payload shape', async () => {
    const provider = new MonnifyPaymentProvider(config);
    const result = await provider.initialize({
      amount: 100,
      currency: 'NGN',
      idempotencyKey: 'fund-1',
      customerEmail: 'lau.e2e.test@gmail.com',
    });

    const init = calls.find((c) => c.url.endsWith('/api/v1/merchant/transactions/init-transaction'));
    expect(init).toBeDefined();
    expect(init?.body.paymentReference).toMatch(/^LAU_fund1$/);
    expect(init?.body.currencyCode).toBe('NGN');
    expect(init?.body.customerName).toBeTruthy();
    expect(init?.body.contractCode).toBe('contract-code');

    expect(result.status).toBe('PENDING');
    expect(result.providerReference).toBe('MNFY|1|X');
    expect((result.raw as any).checkoutUrl).toContain('monnify.com/checkout');
  });

  it('verifies via /api/v2/transactions/{reference} and maps PAID to SUCCESS', async () => {
    const provider = new MonnifyPaymentProvider(config);
    const result = await provider.verifyTransaction('MNFY|1|X');
    expect(calls.some((c) => c.url.includes('/api/v2/transactions/'))).toBe(true);
    expect(result.status).toBe('SUCCESS');
  });
});
