import { BadGatewayException, GatewayTimeoutException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHmac, createHash } from 'crypto';
import { AppConfigService } from '../../config/app-config.service';

export interface ProoftrailCreateResponse { caseId: string; externalTransactionId: string; status: string; createdAt: string; }
export interface ProoftrailStatusResponse {
  caseId: string; externalTransactionId: string; status: string; createdAt: string; updatedAt: string;
  evidenceCount: number; findingsCount: number; reportAvailable: boolean;
  report: { version: number; sha256: string; createdAt: string } | null;
}

@Injectable()
export class ProoftrailClient {
  constructor(private readonly config: AppConfigService) {}

  private ensureEnabled() {
    if (!this.config.prooftrailEnabled) throw new ServiceUnavailableException('ProofTrail integration is not enabled');
  }

  private headers(timestamp: number, rawBody: string, extra: Record<string, string> = {}) {
    const signature = `sha256=${createHmac('sha256', this.config.prooftrailApiSecret).update(`${timestamp}.${rawBody}`).digest('hex')}`;
    return { 'X-ProofTrail-Key': this.config.prooftrailApiKey, 'X-ProofTrail-Timestamp': String(timestamp), 'X-ProofTrail-Signature': signature, ...extra };
  }

  private async request<T>(path: string, init: RequestInit, rawBody: string, extra: Record<string, string> = {}): Promise<T> {
    this.ensureEnabled();
    const timestamp = Math.floor(Date.now() / 1000);
    let response: Response;
    try {
      response = await fetch(`${this.config.prooftrailBaseUrl}${path}`, {
        ...init,
        headers: { ...this.headers(timestamp, rawBody, extra), ...(init.headers ?? {}) },
        signal: AbortSignal.timeout(this.config.prooftrailTimeoutMs),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'TimeoutError') throw new GatewayTimeoutException('ProofTrail request timed out');
      throw new BadGatewayException('ProofTrail is unavailable');
    }
    const text = await response.text();
    let body: unknown;
    try { body = text ? JSON.parse(text) : null; } catch { body = null; }
    if (!response.ok) {
      const message = body && typeof body === 'object' && 'message' in body && typeof (body as { message?: unknown }).message === 'string' ? (body as { message: string }).message : `ProofTrail returned HTTP ${response.status}`;
      throw new BadGatewayException(message);
    }
    return body as T;
  }

  async createDispute(payload: Record<string, unknown>, idempotencyKey: string): Promise<ProoftrailCreateResponse> {
    const body = JSON.stringify(payload);
    const response = await this.request<{ success: boolean; data: ProoftrailCreateResponse }>('/api/v1/integrations/disputes', { method: 'POST', body }, body, { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey });
    return response.data;
  }

  getStatus(caseId: string): Promise<ProoftrailStatusResponse> {
    return this.request<{ success: boolean; data: ProoftrailStatusResponse }>(`/api/v1/integrations/disputes/${encodeURIComponent(caseId)}`, { method: 'GET' }, '').then((response) => response.data);
  }

  async uploadEvidence(caseId: string, file: { buffer: Buffer; filename: string; mimetype: string }, idempotencyKey: string): Promise<Record<string, unknown>> {
    const boundary = `----LauPayProofTrail${createHash('sha256').update(`${Date.now()}-${Math.random()}`).digest('hex').slice(0, 24)}`;
    const prefix = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.filename.replace(/["\\\r\n]/g, '_')}"\r\nContent-Type: ${file.mimetype || 'application/octet-stream'}\r\n\r\n`, 'utf8');
    const suffix = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
    const body = Buffer.concat([prefix, file.buffer, suffix]);
    // ProofTrail's evidence route hashes base64(raw multipart bytes), then its
    // auth helper signs timestamp + "." + that hex request hash.
    const bodyHash = createHash('sha256').update(body.toString('base64')).digest('hex');
    const response = await this.request<{ success: boolean; data: Record<string, unknown> }>(`/api/v1/integrations/disputes/${encodeURIComponent(caseId)}/evidence`, { method: 'POST', body, headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Idempotency-Key': idempotencyKey } }, bodyHash);
    return response.data;
  }
}
