import { AppConfigService } from './app-config.service';

/**
 * Regression coverage for the boot-time safety guard (see main.ts):
 *  - production must never run a mock/simulated provider;
 *  - staging/dev must never hold a LIVE provider credential.
 */
describe('AppConfigService.assertStagingSafety', () => {
  const MANAGED = [
    'DATABASE_URL',
    'NODE_ENV',
    'PAYMENT_PROVIDER',
    'VTU_PROVIDER',
    'FULFILLMENT_MODE',
    'JWT_ACCESS_SECRET',
    'OTP_PEPPER',
    'PAYSTACK_SECRET_KEY',
    'PAYSTACK_WEBHOOK_SECRET',
    'MONNIFY_API_KEY',
    'MONNIFY_SECRET_KEY',
    'MONNIFY_CONTRACT_CODE',
    'MONNIFY_BASE_URL',
    'VTPASS_API_KEY',
    'VTPASS_SECRET_KEY',
    'VTPASS_BASE_URL',
    'VTPASS_TEST_OUTCOME',
    'VTUAGENT_API_KEY',
    'VTUAGENT_BASE_URL',
    'CHEAPDATAHUB_API_KEY',
    'CHEAPDATAHUB_BASE_URL',
    'VTU_PROVIDER_TIMEOUT_MS',
  ];

  let saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    saved = {};
    for (const key of MANAGED) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
    process.env.DATABASE_URL = 'postgresql://localhost/laupay_test';
    process.env.OTP_PEPPER = 'test-pepper-value'.padEnd(40, 'x');
  });

  afterEach(() => {
    for (const key of MANAGED) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  function config() {
    return new AppConfigService();
  }

  function configureProductionVtuAgent() {
    process.env.NODE_ENV = 'production';
    process.env.JWT_ACCESS_SECRET = 'production-access-secret';
    process.env.PAYMENT_PROVIDER = 'paystack';
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_x';
    process.env.PAYSTACK_WEBHOOK_SECRET = 'wh';
    process.env.VTU_PROVIDER = 'vtuagent';
    process.env.VTUAGENT_API_KEY = 'provider-key';
    process.env.FULFILLMENT_MODE = 'live';
  }

  it('refuses mock payment provider in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.PAYMENT_PROVIDER = 'mock';
    process.env.VTU_PROVIDER = 'mock';
    process.env.JWT_ACCESS_SECRET = 'x';
    expect(() => config().assertStagingSafety()).toThrow(/PAYMENT_PROVIDER=mock/);
  });

  it('refuses simulated fulfillment in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_ACCESS_SECRET = 'x';
    process.env.PAYMENT_PROVIDER = 'paystack';
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_x';
    process.env.PAYSTACK_WEBHOOK_SECRET = 'wh';
    process.env.VTU_PROVIDER = 'vtuagent';
    process.env.VTUAGENT_API_KEY = 'a';
    process.env.FULFILLMENT_MODE = 'simulated';
    expect(() => config().assertStagingSafety()).toThrow(/FULFILLMENT_MODE=simulated/);
  });

  it('allows a real provider configuration in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_ACCESS_SECRET = 'x';
    process.env.PAYMENT_PROVIDER = 'paystack';
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_x';
    process.env.PAYSTACK_WEBHOOK_SECRET = 'wh';
    process.env.VTU_PROVIDER = 'vtuagent';
    process.env.VTUAGENT_API_KEY = 'a';
    process.env.FULFILLMENT_MODE = 'live';
    expect(() => config().assertStagingSafety()).not.toThrow();
  });

  it('refuses VTpass provider_test mode in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_ACCESS_SECRET = 'x';
    process.env.PAYMENT_PROVIDER = 'paystack';
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_x';
    process.env.PAYSTACK_WEBHOOK_SECRET = 'wh';
    process.env.VTU_PROVIDER = 'vtpass';
    process.env.VTPASS_API_KEY = 'a';
    process.env.VTPASS_SECRET_KEY = 's';
    process.env.VTPASS_BASE_URL = 'https://sandbox.vtpass.com';
    process.env.FULFILLMENT_MODE = 'provider_test';
    process.env.VTPASS_TEST_OUTCOME = 'success';
    const instance = config();
    expect(instance.fulfillmentMode).toBe('provider_test');
    expect(() => instance.assertStagingSafety()).toThrow(/provider_test is not allowed/);
  });

  it('refuses a sandbox VTpass endpoint in production live mode', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_ACCESS_SECRET = 'x';
    process.env.PAYMENT_PROVIDER = 'paystack';
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_x';
    process.env.PAYSTACK_WEBHOOK_SECRET = 'wh';
    process.env.VTU_PROVIDER = 'vtpass';
    process.env.VTPASS_API_KEY = 'a';
    process.env.VTPASS_SECRET_KEY = 's';
    process.env.VTPASS_BASE_URL = 'https://sandbox.vtpass.com';
    process.env.FULFILLMENT_MODE = 'live';
    process.env.VTPASS_TEST_OUTCOME = 'provider';
    expect(() => config().assertStagingSafety()).toThrow(/VTPASS_BASE_URL must be a valid HTTPS URL for vtpass\.com/);
  });

  it('refuses synthetic VTpass success overrides in production live mode', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_ACCESS_SECRET = 'x';
    process.env.PAYMENT_PROVIDER = 'paystack';
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_x';
    process.env.PAYSTACK_WEBHOOK_SECRET = 'wh';
    process.env.VTU_PROVIDER = 'vtpass';
    process.env.VTPASS_API_KEY = 'a';
    process.env.VTPASS_SECRET_KEY = 's';
    process.env.VTPASS_BASE_URL = 'https://vtpass.com';
    process.env.FULFILLMENT_MODE = 'live';
    process.env.VTPASS_TEST_OUTCOME = 'success';
    expect(() => config().assertStagingSafety()).toThrow(/VTPASS_TEST_OUTCOME overrides/);
  });

  it('refuses an untrusted VTpass URL in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_ACCESS_SECRET = 'production-access-secret';
    process.env.PAYMENT_PROVIDER = 'paystack';
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_x';
    process.env.PAYSTACK_WEBHOOK_SECRET = 'wh';
    process.env.VTU_PROVIDER = 'vtpass';
    process.env.VTPASS_API_KEY = 'provider-key';
    process.env.VTPASS_SECRET_KEY = 'provider-secret';
    process.env.VTPASS_BASE_URL = 'https://vtpass.production.invalid';
    process.env.FULFILLMENT_MODE = 'live';
    expect(() => config().assertStagingSafety()).toThrow(/VTPASS_BASE_URL must be a valid HTTPS URL for vtpass\.com/);
  });

  it('refuses an untrusted VTUAgent URL in production', () => {
    configureProductionVtuAgent();
    process.env.VTUAGENT_BASE_URL = 'https://provider-proxy.example/v1';
    expect(() => config().assertStagingSafety()).toThrow(/VTUAGENT_BASE_URL must be a valid HTTPS URL for api\.vtuagent\.com/);
  });

  it('refuses nonstandard ports and untrusted CheapDataHub endpoints in production', () => {
    configureProductionVtuAgent();
    process.env.VTUAGENT_BASE_URL = 'https://api.vtuagent.com:8443/v1';
    expect(() => config().assertStagingSafety()).toThrow(/VTUAGENT_BASE_URL must be a valid HTTPS URL/);

    process.env.VTU_PROVIDER = 'cheapdatahub';
    process.env.CHEAPDATAHUB_API_KEY = 'provider-key';
    process.env.CHEAPDATAHUB_BASE_URL = 'https://api.cheapdatahub.ng/api/v1';
    expect(() => config().assertStagingSafety()).toThrow(/CHEAPDATAHUB_BASE_URL must be a valid HTTPS URL for www\.cheapdatahub\.ng/);
  });

  it('refuses missing, short, or example OTP peppers in production', () => {
    configureProductionVtuAgent();
    delete process.env.OTP_PEPPER;
    expect(() => config()).toThrow(/Missing required environment variable: OTP_PEPPER/);

    process.env.OTP_PEPPER = 'short';
    expect(() => config()).toThrow(/OTP_PEPPER must be a non-placeholder secret/);

    process.env.OTP_PEPPER = 'replace-with-a-random-secret-of-at-least-32-characters';
    expect(() => config()).toThrow(/OTP_PEPPER must be a non-placeholder secret/);
  });

  it('refuses a LIVE Paystack key outside production', () => {
    process.env.NODE_ENV = 'staging';
    process.env.PAYMENT_PROVIDER = 'paystack';
    process.env.PAYSTACK_SECRET_KEY = 'sk_live_abc';
    process.env.PAYSTACK_WEBHOOK_SECRET = 'wh';
    expect(() => config().assertStagingSafety()).toThrow(/LIVE Paystack/);
  });

  it('refuses a LIVE Monnify key outside production', () => {
    process.env.NODE_ENV = 'staging';
    process.env.PAYMENT_PROVIDER = 'monnify';
    process.env.MONNIFY_API_KEY = 'MK_PROD_api';
    process.env.MONNIFY_SECRET_KEY = 'MK_TEST_secret';
    process.env.MONNIFY_CONTRACT_CODE = 'c';
    process.env.MONNIFY_BASE_URL = 'https://sandbox.monnify.com';
    expect(() => config().assertStagingSafety()).toThrow(/LIVE Monnify/);
  });

  it('allows a sandbox Monnify configuration outside production', () => {
    process.env.NODE_ENV = 'staging';
    process.env.PAYMENT_PROVIDER = 'monnify';
    process.env.MONNIFY_API_KEY = 'MK_TEST_api';
    process.env.MONNIFY_SECRET_KEY = 'MK_TEST_secret';
    process.env.MONNIFY_CONTRACT_CODE = 'c';
    process.env.MONNIFY_BASE_URL = 'https://sandbox.monnify.com';
    expect(() => config().assertStagingSafety()).not.toThrow();
  });

  it('refuses a real provider in non-live mode because it has no public sandbox', () => {
    process.env.NODE_ENV = 'staging';
    process.env.VTU_PROVIDER = 'cheapdatahub';
    process.env.CHEAPDATAHUB_API_KEY = 'a';
    process.env.FULFILLMENT_MODE = 'provider_test';
    expect(() => config().assertStagingSafety()).toThrow(/no public sandbox/);
  });
});
