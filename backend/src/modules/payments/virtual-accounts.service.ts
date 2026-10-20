import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';

export interface VirtualAccountView {
  provider: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  reference: string;
}

interface MonnifyAccount {
  bankName?: string;
  bankCode?: string;
  accountNumber?: string;
  accountName?: string;
}

export interface VirtualAccountEventRefs {
  productReference?: string;
  accountReference?: string;
  paymentReference?: string;
  accountNumber?: string;
}

/**
 * Monnify reserved ("virtual") accounts for wallet deposits.
 *
 * Each customer gets one stable NUBAN per bank returned by Monnify. The VIRTUAL
 * ACCOUNT itself is created with the customer's BVN in live mode; in sandbox /
 * provider_test deployments a configured test BVN is used instead. BVNs are
 * forwarded to Monnify and never persisted here.
 */
@Injectable()
export class VirtualAccountsService {
  private readonly logger = new Logger(VirtualAccountsService.name);
  private cachedToken?: { token: string; expiresAt: number };

  constructor(
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async getForUser(userId: string): Promise<VirtualAccountView | null> {
    const account = await this.prisma.virtualAccount.findUnique({ where: { userId } });
    return account ? this.toView(account) : null;
  }

  async ensureForUser(userId: string, suppliedBvn?: string): Promise<VirtualAccountView> {
    const existing = await this.prisma.virtualAccount.findUnique({ where: { userId } });
    if (existing) return this.toView(existing);

    if (!this.config.monnifyVirtualAccountsConfigured) {
      throw new ServiceUnavailableException('Deposit accounts are not configured yet. Please use card funding.');
    }

    const bvn = this.resolveBvn(suppliedBvn);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const token = await this.accessToken();
    const accountReference = `LAUPAY_${userId.replace(/-/g, '').slice(0, 32)}`;

    const response = await fetch(`${this.baseUrl}/api/v2/bank-transfer/reserved-accounts`, {
      method: 'POST',
      headers: this.headers(token),
      body: JSON.stringify({
        accountReference,
        accountName: user.fullName,
        currencyCode: 'NGN',
        contractCode: this.config.monnifyContractCode,
        customerEmail: user.email,
        customerName: user.fullName,
        getAllAvailableBanks: true,
        bvn,
      }),
    });

    const body = (await response.json().catch(() => ({}))) as {
      requestSuccessful?: boolean;
      responseMessage?: string;
      responseBody?: { accountReference?: string; accounts?: MonnifyAccount[]; accountName?: string };
    };
    const accounts = body.responseBody?.accounts ?? [];
    const primary = accounts.find((item) => item.accountNumber);

    if (!response.ok || !body.requestSuccessful || !primary?.accountNumber) {
      this.logger.error(`Monnify reserved account failed: ${response.status} ${body.responseMessage ?? ''}`);
      throw new ServiceUnavailableException(
        body.responseMessage || 'Could not create your deposit account. Please try again.',
      );
    }

    try {
      const account = await this.prisma.virtualAccount.create({
        data: {
          userId,
          provider: 'monnify',
          accountReference,
          accountName: body.responseBody?.accountName ?? primary.accountName ?? user.fullName,
          bankName: primary.bankName ?? 'Wema Bank',
          accountNumber: primary.accountNumber,
          accounts: accounts as unknown as Prisma.InputJsonValue,
        },
      });
      return this.toView(account);
    } catch (error) {
      // A concurrent request may have created the row first — return that one.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const account = await this.prisma.virtualAccount.findUniqueOrThrow({ where: { userId } });
        return this.toView(account);
      }
      throw error;
    }
  }

  /** Finds the owning virtual account from a Monnify webhook payload. */
  async findForEvent(refs: VirtualAccountEventRefs) {
    const references = [refs.productReference, refs.accountReference, refs.paymentReference].filter(
      (value): value is string => typeof value === 'string' && value.length > 0,
    );
    for (const reference of references) {
      const account = await this.prisma.virtualAccount.findUnique({
        where: { accountReference: reference },
      });
      if (account) return account;
    }
    if (refs.accountNumber) {
      return this.prisma.virtualAccount.findFirst({ where: { accountNumber: refs.accountNumber } });
    }
    return null;
  }

  private resolveBvn(supplied?: string): string {
    if (supplied) {
      if (!/^\d{11}$/.test(supplied)) throw new BadRequestException('Enter a valid 11-digit BVN');
      return supplied;
    }
    // A live deployment must collect the real BVN; never silently use a test one.
    if (this.config.fulfillmentMode !== 'live' && this.config.monnifyTestBvn) {
      return this.config.monnifyTestBvn;
    }
    throw new BadRequestException(
      this.config.fulfillmentMode === 'live'
        ? 'Your BVN is required to create a deposit account'
        : 'Deposit accounts are unavailable right now',
    );
  }

  private get baseUrl(): string {
    return this.config.monnifyBaseUrl.replace(/\/$/, '');
  }

  private headers(token: string): Record<string, string> {
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'LAUPAY/1.0 (+https://laupay.app)',
    };
  }

  private async accessToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 30_000) {
      return this.cachedToken.token;
    }
    const credentials = Buffer.from(
      `${this.config.monnifyApiKey}:${this.config.monnifySecretKey}`,
    ).toString('base64');
    const response = await fetch(`${this.baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
        'User-Agent': 'LAUPAY/1.0 (+https://laupay.app)',
      },
      body: JSON.stringify({}),
    });
    const body = (await response.json().catch(() => ({}))) as {
      requestSuccessful?: boolean;
      responseMessage?: string;
      responseBody?: { accessToken?: string };
    };
    const token = body.responseBody?.accessToken;
    if (!response.ok || !body.requestSuccessful || !token) {
      this.logger.error(`Monnify auth failed: ${response.status} ${body.responseMessage ?? ''}`);
      throw new ServiceUnavailableException('Deposit accounts are temporarily unavailable');
    }
    this.cachedToken = { token, expiresAt: Date.now() + 50 * 60 * 1000 };
    return token;
  }

  private toView(account: {
    provider: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
    accountReference: string;
  }): VirtualAccountView {
    return {
      provider: account.provider,
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      accountName: account.accountName,
      reference: account.accountReference,
    };
  }
}
