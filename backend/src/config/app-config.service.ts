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
}
