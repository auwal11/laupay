import { Injectable } from '@nestjs/common';

export type ExpoPushTicket = {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
};
export type ExpoPushReceipt = {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
};

export class ExpoPushHttpError extends Error {
  constructor(readonly status: number) {
    super(`Expo push service returned HTTP ${status}`);
    this.name = 'ExpoPushHttpError';
  }
}

@Injectable()
export class ExpoPushProvider {
  private readonly baseUrl = 'https://exp.host/--/api/v2/push';

  async send(token: string, notificationId: string): Promise<ExpoPushTicket> {
    const payload = {
      to: token,
      sound: 'default',
      title: 'LAUPAY',
      // Keep financial details and personal data off lock screens. The full
      // authoritative record is available after signing in to the app.
      body: 'You have a new secure account update. Sign in to view details.',
      data: { notificationId, route: '/notifications' },
      channelId: 'transaction_updates',
      priority: 'high',
    };
    const response = await this.post(`${this.baseUrl}/send`, payload);
    const body = await parseJson(response);
    const ticket = Array.isArray(body.data) ? body.data[0] : body.data;
    if (!ticket || typeof ticket !== 'object' || !('status' in ticket)) {
      throw new Error('Expo push service returned an invalid ticket response');
    }
    return ticket as ExpoPushTicket;
  }

  async getReceipts(ticketIds: string[]): Promise<Record<string, ExpoPushReceipt | undefined>> {
    if (ticketIds.length === 0) return {};
    const response = await this.post(`${this.baseUrl}/getReceipts`, { ids: ticketIds });
    const body = await parseJson(response);
    return body.data && typeof body.data === 'object'
      ? body.data as Record<string, ExpoPushReceipt | undefined>
      : {};
  }

  private async post(url: string, payload: unknown): Promise<Response> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new ExpoPushHttpError(response.status);
    return response;
  }
}

async function parseJson(response: Response): Promise<{ data?: unknown }> {
  try {
    return await response.json() as { data?: unknown };
  } catch {
    throw new Error('Expo push service returned invalid JSON');
  }
}
