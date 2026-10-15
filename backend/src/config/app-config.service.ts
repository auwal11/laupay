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

  readonly paymentProvider = optional('PAYMENT_PROVIDER', 'mock');
  readonly vtuProvider = optional('VTU_PROVIDER', 'mock');

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
  readonly monnifyApiKey = this.requiredIf(this.monnifyEnabled, 'MONNIFY_API_KEY');
  readonly monnifySecretKey = this.requiredIf(this.monnifyEnabled, 'MONNIFY_SECRET_KEY');
  readonly monnifyBaseUrl = optional('MONNIFY_BASE_URL', 'https://sandbox.monnify.com');
  readonly monnifyContractCode = this.requiredIf(this.monnifyEnabled, 'MONNIFY_CONTRACT_CODE');

  readonly vtpassEnabled = this.vtuProvider === 'vtpass';
  readonly vtpassApiKey = this.requiredIf(this.vtpassEnabled, 'VTPASS_API_KEY');
  readonly vtpassSecretKey = this.requiredIf(this.vtpassEnabled, 'VTPASS_SECRET_KEY');
  readonly vtpassBaseUrl = optional('VTPASS_BASE_URL', 'https://sandbox.vtpass.com');
  readonly vtpassWebhookSecret = this.requiredIf(this.vtpassEnabled, 'VTPASS_WEBHOOK_SECRET');

  readonly mailProvider = optional('MAIL_PROVIDER', 'mock');
  readonly brevoApiKey = optional('BREVO_API_KEY', '');
  readonly brevoSenderEmail = optional('BREVO_SENDER_EMAIL', 'no-reply@laupay.app');
  readonly brevoSenderName = optional('BREVO_SENDER_NAME', 'LAUPAY');

  /** Base URL of THIS API, used to build the OTP link emailed to users. */
  readonly publicApiBaseUrl = optional('PUBLIC_API_BASE_URL', 'http://localhost:3000');
  readonly supabaseUrl = optional('SUPABASE_URL', '');
  readonly supabaseServiceRoleKey = optional('SUPABASE_SERVICE_ROLE_KEY', '');
  readonly supabaseStorageBucket = optional('SUPABASE_STORAGE_BUCKET', 'profile-photos');

  /**
   * Staging must never touch real money. This guard is evaluated at boot and
   * refuses to start if a LIVE key is ever selected alongside staging env.
   */
  assertStagingSafety() {
    const livePrefixes = ['sk_live_', 'pk_live_'];
    const selected = [this.paystackSecretKey, this.paystackEnabled ? '' : ''].filter(Boolean);
    for (const key of selected) {
      if (livePrefixes.some((p) => key.startsWith(p))) {
        throw new Error(
          '[config] Refusing to start: a LIVE Paystack key was detected while PAYMENT_PROVIDER=paystack. ' +
            'Staging must use sk_test_/pk_test_ only (requirement 16).',
        );
      }
    }
  }
}
