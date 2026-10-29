import { Injectable } from '@nestjs/common';

/**
 * Fails fast at boot if a required environment variable is missing.
 * Never falls back to an insecure default in production.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(
      `[config] Missing required environment variable: ${name}. ` +
        `See backend/.env.example for the full list of required variables.`,
    );
  }
  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() !== '' ? value : fallback;
}

@Injectable()
export class AppConfigService {
  readonly nodeEnv = optional('NODE_ENV', 'development');
  readonly isProduction = this.nodeEnv === 'production';
  readonly port = Number(optional('PORT', '3000'));

  readonly databaseUrl = required('DATABASE_URL');

  readonly jwtAccessSecret = this.isProduction
    ? required('JWT_ACCESS_SECRET')
    : optional('JWT_ACCESS_SECRET', 'dev-only-insecure-secret-change-me');
  readonly jwtAccessExpiresIn = optional('JWT_ACCESS_EXPIRES_IN', '15m');
  readonly jwtRefreshExpiresInDays = Number(
    optional('JWT_REFRESH_EXPIRES_IN', '30d').replace(/[^0-9]/g, '') || '30',
  );

  readonly adminWebOrigin = optional('ADMIN_WEB_ORIGIN', 'http://localhost:5173');
  /** Explicit comma-separated browser origins allowed to call the API. */
  readonly allowedWebOrigins = (() => {
    const configured = process.env.ALLOWED_WEB_ORIGINS
      ?.split(',')
      .map((origin) => origin.trim().replace(/\/$/, ''))
      .filter(Boolean);
    return configured?.length ? configured : [this.adminWebOrigin.replace(/\/$/, '')];
  })();

  readonly paymentProvider = optional('PAYMENT_PROVIDER', 'mock');
  // Mock VTU is only a test double. Production must explicitly select one of
  // the supported real providers below.
  readonly vtuProvider = optional('VTU_PROVIDER', this.isProduction ? 'vtuagent' : 'mock');

  // === Staging/TEST-only provider credentials ============================
  // Never rendered into a response and never sent to the client bundle —
  // these live only in process.env. `requiredIf()` fails fast when the
  // corresponding provider is selected, so a missing key is a boot error
  // rather than a runtime surprise halfway through a customer's purchase.
  private requiredIf(enabled: boolean, name: string): string {
    if (!enabled) return optional(name, '');
    return required(name);
  }

  readonly paystackEnabled = this.paymentProvider === 'paystack';
  readonly paystackSecretKey = this.requiredIf(this.paystackEnabled, 'PAYSTACK_SECRET_KEY');
  readonly paystackWebhookSecret = this.requiredIf(this.paystackEnabled, 'PAYSTACK_WEBHOOK_SECRET');

  readonly monnifyEnabled = this.paymentProvider === 'monnify';
  // Monnify reserved accounts run alongside Paystack checkout, so these keys
  // must load even when PAYMENT_PROVIDER=paystack. They are only mandatory
  // when Monnify itself is the checkout provider.
  readonly monnifyApiKey = this.monnifyEnabled ? required('MONNIFY_API_KEY') : optional('MONNIFY_API_KEY', '');
  readonly monnifySecretKey = this.monnifyEnabled ? required('MONNIFY_SECRET_KEY') : optional('MONNIFY_SECRET_KEY', '');
  readonly monnifyBaseUrl = optional('MONNIFY_BASE_URL', 'https://sandbox.monnify.com');
  readonly monnifyContractCode = this.monnifyEnabled ? required('MONNIFY_CONTRACT_CODE') : optional('MONNIFY_CONTRACT_CODE', '');
  /**
   * Reserved (virtual) accounts are created independently of PAYMENT_PROVIDER,
   * so the Monnify keys are read even when Paystack handles checkout. In
   * non-live modes a configured test BVN is used for the sandbox; a live
   * deployment requires the customer to supply their own BVN.
   */
  readonly monnifyTestBvn = optional('MONNIFY_TEST_BVN', '');
  get monnifyVirtualAccountsConfigured(): boolean {
    return !!(this.monnifyApiKey && this.monnifySecretKey && this.monnifyContractCode);
  }

  readonly vtuAgentEnabled = this.vtuProvider === 'vtuagent';
  readonly cheapDataHubEnabled = this.vtuProvider === 'cheapdatahub';
  readonly vtpassEnabled = this.vtuProvider === 'vtpass'; // legacy rows/config only; not allowed in production
  readonly vtuAgentApiKey = this.requiredIf(this.vtuAgentEnabled, 'VTUAGENT_API_KEY');
  readonly vtuAgentBaseUrl = optional('VTUAGENT_BASE_URL', 'https://api.vtuagent.com/v1').replace(/\/$/, '');
  readonly cheapDataHubApiKey = this.requiredIf(this.cheapDataHubEnabled, 'CHEAPDATAHUB_API_KEY');
  readonly cheapDataHubBaseUrl = optional('CHEAPDATAHUB_BASE_URL', 'https://www.cheapdatahub.ng/api/v1/resellers').replace(/\/$/, '');
  readonly cheapDataHubPlansJson = optional('CHEAPDATAHUB_PLANS_JSON', '[]');
  readonly cheapDataHubNetworkIdsJson = optional('CHEAPDATAHUB_NETWORK_IDS_JSON', '{}');
  readonly vtuProviderTimeoutMs = Math.min(Math.max(Number(optional('VTU_PROVIDER_TIMEOUT_MS', '15000')), 3000), 30000);

  get cheapDataHubPlans(): Array<{ network: string; bundleId: number; label: string; price: number; validityDays?: number }> {
    try {
      const parsed = JSON.parse(this.cheapDataHubPlansJson) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item): item is { network: string; bundleId: number; label: string; price: number; validityDays?: number } => {
        if (!item || typeof item !== 'object') return false;
        const value = item as Record<string, unknown>;
        return typeof value.network === 'string' && Number.isInteger(value.bundleId) && Number(value.bundleId) > 0 &&
          typeof value.label === 'string' && Number.isFinite(value.price) && Number(value.price) > 0;
      });
    } catch {
      return [];
    }
  }

  get cheapDataHubNetworkIds(): Record<string, number> {
    try {
      const parsed = JSON.parse(this.cheapDataHubNetworkIdsJson) as unknown;
      if (!parsed || typeof parsed !== 'object') return {};
      return Object.fromEntries(Object.entries(parsed as Record<string, unknown>)
        .filter(([key, value]) => /^[A-Z0-9]+$/.test(key) && Number.isInteger(value) && Number(value) > 0)
        .map(([key, value]) => [key, Number(value)]));
    } catch {
      return {};
    }
  }
  readonly vtpassApiKey = this.requiredIf(this.vtpassEnabled, 'VTPASS_API_KEY');
  readonly vtpassSecretKey = this.requiredIf(this.vtpassEnabled, 'VTPASS_SECRET_KEY');
  readonly vtpassBaseUrl = optional('VTPASS_BASE_URL', 'https://sandbox.vtpass.com');
  /** Explicit QA-only outcome override for provider_test; default calls VTpass. */
  readonly vtpassTestOutcome = optional('VTPASS_TEST_OUTCOME', 'provider');

  readonly mailProvider = optional('MAIL_PROVIDER', 'mock');
  readonly brevoApiKey = optional('BREVO_API_KEY', '');
  readonly brevoSenderEmail = optional('BREVO_SENDER_EMAIL', 'no-reply@laupay.app');
  readonly brevoSenderName = optional('BREVO_SENDER_NAME', 'LAUPAY');

  /**
   * How VTU orders are fulfilled:
   *   simulated     - debit the wallet, mark SUCCESS, never call a real provider
   *   provider_test - call the provider's TEST/SANDBOX API, use its status
   *   live          - real fulfillment (requires live keys)
   * Defaults to `simulated` so nothing real can be purchased by accident.
   */
  readonly fulfillmentMode = optional('FULFILLMENT_MODE', 'simulated');
  get isSimulatedFulfillment(): boolean {
    return this.fulfillmentMode === 'simulated';
  }

  /**
   * Optional one-time admin bootstrap. When both are set, the app ensures an
   * ADMIN user with this email/password exists at boot (idempotent). Used to
   * create the first admin on a fresh deployment without shell/DB access.
   */
  readonly adminBootstrapEmail = optional('ADMIN_EMAIL', '');
  readonly adminBootstrapPassword = optional('ADMIN_PASSWORD', '');
  readonly adminBootstrapName = optional('ADMIN_NAME', 'LAUPAY Admin');
  /** Only these immutable user IDs may grant the ADMIN role. */
  readonly superAdminIds = new Set(
    (process.env.SUPER_ADMIN_IDS ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  );

  /** Base URL of THIS API, used to build the OTP link emailed to users. */
  readonly publicApiBaseUrl = optional('PUBLIC_API_BASE_URL', 'http://localhost:3000');
  readonly supabaseUrl = optional('SUPABASE_URL', '');
  readonly supabaseServiceRoleKey = optional('SUPABASE_SERVICE_ROLE_KEY', '');
  readonly supabaseStorageBucket = optional('SUPABASE_STORAGE_BUCKET', 'profile-photos');

  /**
   * Bank directory used by the withdrawal form. This must be populated from
   * the configured payout provider's authoritative directory; an empty value
   * intentionally disables withdrawals rather than presenting an unverified
   * hard-coded list.
   */
  readonly withdrawalBanksJson = optional('WITHDRAWAL_BANKS_JSON', '[]');
  get withdrawalBanks(): Array<{ code: string; name: string }> {
    try {
      const parsed = JSON.parse(this.withdrawalBanksJson) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (bank): bank is { code: string; name: string } =>
          !!bank && typeof bank === 'object' &&
          typeof (bank as { code?: unknown }).code === 'string' &&
          typeof (bank as { name?: unknown }).name === 'string',
      );
    } catch {
      return [];
    }
  }

  /**
   * Guard evaluated at boot (see main.ts).
   *
   *  - In PRODUCTION: refuses to start with any mock/simulated provider, so a
   *    real deployment can never silently fake a payment or fulfillment.
   *  - In every other environment (staging/dev): refuses to start if a LIVE
   *    provider credential is present, so staging can never touch real money.
   */
  assertStagingSafety() {
    if (this.isProduction) {
      if (this.paymentProvider === 'mock') {
        throw new Error(
          '[config] Refusing to start: PAYMENT_PROVIDER=mock in production. ' +
            'Real funding must go through paystack/monnify.',
        );
      }
      if (this.vtuProvider === 'mock') {
        throw new Error(
          '[config] Refusing to start: VTU_PROVIDER=mock in production. ' +
            'Real fulfillment must use VTU_PROVIDER=vtuagent or cheapdatahub.',
          );
      }
      // Keep an existing VTpass deployment bootable during migration. VTpass
      // is a real provider (not a mock); new deployments should use
      // vtuagent/cheapdatahub, but a config rollout must not take auth down
      // before Railway variables have been changed.
      if (!['vtuagent', 'cheapdatahub', 'vtpass'].includes(this.vtuProvider)) {
        throw new Error(
          `[config] Refusing to start: unsupported VTU_PROVIDER=${this.vtuProvider}. ` +
            'Use vtuagent, cheapdatahub, or the legacy real vtpass provider while migrating.',
        );
      }
      if (this.fulfillmentMode === 'simulated') {
        throw new Error(
          '[config] Refusing to start: FULFILLMENT_MODE=simulated in production. ' +
            'Use provider_test or live.',
        );
      }
      if (this.fulfillmentMode !== 'live') {
        throw new Error(
          `[config] Refusing to start: real VTU provider ${this.vtuProvider} requires FULFILLMENT_MODE=live. ` +
            'Neither VTUAgent nor CheapDataHub exposes a public sandbox in the configured API contract.',
        );
      }
      return;
    }

    if (['vtuagent', 'cheapdatahub'].includes(this.vtuProvider) && this.fulfillmentMode !== 'live') {
      throw new Error(
        `[config] ${this.vtuProvider} has no public sandbox configured; use FULFILLMENT_MODE=live only with a funded provider account.`,
      );
    }

    // Non-production: a LIVE key alongside staging config is always a mistake.
    if (this.paystackEnabled && ['sk_live_', 'pk_live_'].some((p) => this.paystackSecretKey.startsWith(p))) {
      throw new Error(
        '[config] Refusing to start: a LIVE Paystack key was detected while PAYMENT_PROVIDER=paystack. ' +
          'Staging must use sk_test_/pk_test_ only.',
      );
    }
    if (this.monnifyEnabled) {
      if ([this.monnifyApiKey, this.monnifySecretKey].some((k) => k.startsWith('MK_PROD_'))) {
        throw new Error(
          '[config] Refusing to start: a LIVE Monnify key (MK_PROD_) was detected. ' +
            'Staging must use MK_TEST_ keys only.',
        );
      }
      if (!this.monnifyBaseUrl.includes('sandbox')) {
        throw new Error(
          '[config] Refusing to start: MONNIFY_BASE_URL is not a sandbox host while PAYMENT_PROVIDER=monnify. ' +
            `Got ${this.monnifyBaseUrl}.`,
        );
      }
    }
    if (this.vtpassEnabled && this.fulfillmentMode !== 'live' && !this.vtpassBaseUrl.includes('sandbox')) {
      throw new Error(
        '[config] Refusing to start: VTPASS_BASE_URL is not a sandbox host while testing VTpass. ' +
          `Got ${this.vtpassBaseUrl}.`,
      );
    }
  }
}
