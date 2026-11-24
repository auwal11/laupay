import { createHmac } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import { ProoftrailWebhookController } from './prooftrail.controller';

describe('ProoftrailWebhookController', () => {
  const secret = 'webhook-secret';
  const config = { prooftrailEnabled: true, prooftrailWebhookSecret: secret } as never;
  const service = { receiveWebhook: jest.fn().mockResolvedValue({ duplicate: false, updated: true }) } as { receiveWebhook: jest.Mock };

  beforeEach(() => jest.clearAllMocks());

  it('accepts a valid timestamped signature and forwards the exact parsed payload', async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const raw = JSON.stringify({ event: 'dispute.created', caseId: 'case-1', status: 'collecting_evidence' });
    const signature = `sha256=${createHmac('sha256', secret).update(`${timestamp}.${raw}`).digest('hex')}`;
    const result = await new ProoftrailWebhookController(service as never, config).webhook('event-1', timestamp, signature, { rawBody: Buffer.from(raw) } as never);
    expect(result).toEqual({ duplicate: false, updated: true });
    expect(service.receiveWebhook).toHaveBeenCalledWith('event-1', JSON.parse(raw));
  });

  it('rejects an invalid signature before touching persistence', async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    await expect(new ProoftrailWebhookController(service as never, config).webhook('event-1', timestamp, 'sha256=invalid', { rawBody: Buffer.from('{}') } as never)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(service.receiveWebhook).not.toHaveBeenCalled();
  });
});
