import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppConfigService } from '../../config/app-config.service';

/**
 * Runtime-tunable, non-secret system settings.
 *
 * Secrets (provider API keys) NEVER live here — they stay in environment
 * variables only. This store covers operational switches (kill switches,
 * maintenance), limits, risk thresholds and provider *mode* selection.
 *
 * Reads are cheap and uncached on purpose: a kill switch must take effect on
 * the very next request, not after a restart or a cache TTL.
 */
export const SETTING_DEFAULTS: Record<string, string> = {
  // Service kill switches
  service_airtime_enabled: 'true',
  service_data_enabled: 'true',
  service_wallet_funding_enabled: 'true',

  // Maintenance
  maintenance_mode: 'false',
  maintenance_message: 'LAUPAY is undergoing scheduled maintenance. Please try again shortly.',

  // Support / branding
  support_email: 'support@laupay.app',
  support_phone: '',

  // Operational timeouts
  order_timeout_minutes: '15',

  // Provider mode overrides (empty = inherit environment config)
  provider_fulfillment_mode: '',
  provider_payment_provider: '',

  // Pricing (informational; real prices come from the catalog)
  margin_airtime_percent: '0',
  margin_data_percent: '0',

  // OTP (surfaced; the auth module enforces its own hard limits)
  otp_max_attempts: '5',
  otp_cooldown_seconds: '60',

  // Risk controls
  risk_max_orders_per_day: '20',
  risk_max_amount_per_day: '200000',
  risk_max_failed_tx_per_hour: '10',
  risk_require_second_approval: 'false',
  blacklist_phones: '[]',

};

const FULFILLMENT_MODES = ['simulated', 'provider_test', 'live'];
const PAYMENT_PROVIDERS = ['mock', 'paystack', 'monnify'];

export type ServiceKind = 'airtime' | 'data' | 'wallet_funding';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  async get(key: string): Promise<string> {
    const row = await this.prisma.systemSetting.findUnique({ where: { key } });
    return row?.value ?? SETTING_DEFAULTS[key] ?? '';
  }

  async getBool(key: string): Promise<boolean> {
    return (await this.get(key)).toLowerCase() === 'true';
  }

  async getNumber(key: string): Promise<number> {
    const raw = Number(await this.get(key));
    return Number.isFinite(raw) ? raw : Number(SETTING_DEFAULTS[key] ?? 0);
  }

  async getJson<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: string, adminId?: string) {
    const normalized = this.normalize(key, value);
    const row = await this.prisma.systemSetting.upsert({
      where: { key },
      create: { key, value: normalized, updatedBy: adminId },
      update: { value: normalized, updatedBy: adminId },
    });
    return row;
  }

  async setMany(entries: Record<string, string>, adminId?: string) {
    for (const [key, value] of Object.entries(entries)) {
      await this.set(key, value, adminId);
    }
    return this.snapshot();
  }

  /** Clamp/validate values so a typo cannot disable a limit or set nonsense. */
  private normalize(key: string, value: string): string {
    const v = String(value ?? '').trim();
    if (['maintenance_mode', 'service_airtime_enabled', 'service_data_enabled', 'service_wallet_funding_enabled', 'risk_require_second_approval', 'admin_2fa_required'].includes(key)) {
      return v.toLowerCase() === 'true' ? 'true' : 'false';
    }
    if (key === 'provider_fulfillment_mode') {
      return FULFILLMENT_MODES.includes(v) ? v : '';
    }
    if (key === 'provider_payment_provider') {
      return PAYMENT_PROVIDERS.includes(v) ? v : '';
    }
    if (['order_timeout_minutes', 'risk_max_orders_per_day', 'risk_max_amount_per_day', 'risk_max_failed_tx_per_hour', 'otp_max_attempts', 'otp_cooldown_seconds'].includes(key)) {
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 ? String(n) : (SETTING_DEFAULTS[key] ?? '0');
    }
    if (key === 'blacklist_phones') {
      try {
        const parsed = JSON.parse(v);
        if (Array.isArray(parsed)) return JSON.stringify(parsed.filter((x) => typeof x === 'string').slice(0, 500));
      } catch {
        // accept comma-separated input as a convenience
        return JSON.stringify(v.split(',').map((s) => s.trim()).filter(Boolean));
      }
      return '[]';
    }
    return v.slice(0, 2000);
  }

  // -----------------------------------------------------------------
  // Effortless reads used on hot paths
  // -----------------------------------------------------------------
  async effectiveFulfillmentMode(): Promise<string> {
    const override = await this.get('provider_fulfillment_mode');
    return FULFILLMENT_MODES.includes(override) ? override : this.config.fulfillmentMode;
  }

  async effectivePaymentProvider(): Promise<string> {
    const override = await this.get('provider_payment_provider');
    return PAYMENT_PROVIDERS.includes(override) ? override : this.config.paymentProvider;
  }

  async isServiceEnabled(kind: ServiceKind): Promise<boolean> {
    if (await this.getBool('maintenance_mode')) return false;
    switch (kind) {
      case 'airtime':
        return this.getBool('service_airtime_enabled');
      case 'data':
        return this.getBool('service_data_enabled');
      case 'wallet_funding':
        return this.getBool('service_wallet_funding_enabled');
      default:
        return false;
    }
  }

  async assertServiceEnabled(kind: ServiceKind, label: string): Promise<void> {
    if (await this.getBool('maintenance_mode')) {
      const message = await this.get('maintenance_message');
      throw new ServiceUnavailableException(message || 'LAUPAY is undergoing maintenance.');
    }
    if (!(await this.isServiceEnabled(kind))) {
      throw new ServiceUnavailableException(`${label} is temporarily paused. Please try again later.`);
    }
  }

  async getBlacklistedPhones(): Promise<string[]> {
    return (await this.getJson<string[]>('blacklist_phones')) ?? [];
  }

  async isPhoneBlacklisted(phone: string): Promise<boolean> {
    if (!phone) return false;
    const list = await this.getBlacklistedPhones();
    const normalized = phone.replace(/\D/g, '');
    return list.some((p) => p.replace(/\D/g, '') === normalized);
  }

  async snapshot() {
    const rows = await this.prisma.systemSetting.findMany();
    const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const settings = { ...SETTING_DEFAULTS, ...stored };
    return {
      settings,
      effective: {
        fulfillmentMode: await this.effectiveFulfillmentMode(),
        paymentProvider: await this.effectivePaymentProvider(),
      },
    };
  }
}
