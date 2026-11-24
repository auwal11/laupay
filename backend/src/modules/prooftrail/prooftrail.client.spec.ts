import { createHmac, createHash } from 'crypto';
import { ProoftrailClient } from './prooftrail.client';

describe('ProoftrailClient signing', () => {
  const config = {
    prooftrailEnabled: true,
    prooftrailBaseUrl: 'https://prooftrail.test',
    prooftrailApiKey: 'pt_test_key',
    prooftrailApiSecret: 'pt_test_secret',
    prooftrailTimeoutMs: 10000,
  } as never;

  afterEach(() => jest.restoreAllMocks());

  it('signs exact JSON body and idempotency key', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ success: true, data: { caseId: 'case-1', externalTransactionId: 'laupay:1', status: 'collecting_evidence', createdAt: '2026-11-24T00:00:00.000Z' } }), { status: 201 }));
    const client = new ProoftrailClient(config);
    const payload = { externalTransactionId: 'laupay:1', transaction: { amount: '10.00', currency: 'NGN', type: 'airtime' }, customer: { externalCustomerId: 'user-1' }, dispute: { reason: 'FAILED_BUT_DEBITED' } };
    await client.createDispute(payload, 'laupay-dispute:1');
    const [, init] = fetchMock.mock.calls[0];
    const body = init?.body as string;
    const timestamp = (init?.headers as Record<string, string>)['X-ProofTrail-Timestamp'];
    expect(body).toBe(JSON.stringify(payload));
    expect((init?.headers as Record<string, string>)['Idempotency-Key']).toBe('laupay-dispute:1');
    expect((init?.headers as Record<string, string>)['X-ProofTrail-Signature']).toBe(`sha256=${createHmac('sha256', 'pt_test_secret').update(`${timestamp}.${body}`).digest('hex')}`);
  });

  it('signs status requests with an empty raw body', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ success: true, data: { caseId: 'case-1', externalTransactionId: 'laupay:1', status: 'collecting_evidence', createdAt: '2026-11-24T00:00:00.000Z', updatedAt: '2026-11-24T00:00:00.000Z', evidenceCount: 0, findingsCount: 0, reportAvailable: false, report: null } })));
    await new ProoftrailClient(config).getStatus('case-1');
    const [, init] = fetchMock.mock.calls[0];
    const timestamp = (init?.headers as Record<string, string>)['X-ProofTrail-Timestamp'];
    expect((init?.headers as Record<string, string>)['X-ProofTrail-Signature']).toBe(`sha256=${createHmac('sha256', 'pt_test_secret').update(`${timestamp}.`).digest('hex')}`);
  });

  it('hashes base64 raw multipart bytes before signing evidence', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ success: true, data: { evidenceId: 'e-1' } }), { status: 201 }));
    await new ProoftrailClient(config).uploadEvidence('case-1', { buffer: Buffer.from('%PDF-synthetic'), filename: 'proof.pdf', mimetype: 'application/pdf' }, 'evidence:1');
    const [, init] = fetchMock.mock.calls[0];
    const body = Buffer.from(init?.body as Uint8Array);
    const timestamp = (init?.headers as Record<string, string>)['X-ProofTrail-Timestamp'];
    const bodyHash = createHash('sha256').update(body.toString('base64')).digest('hex');
    expect((init?.headers as Record<string, string>)['X-ProofTrail-Signature']).toBe(`sha256=${createHmac('sha256', 'pt_test_secret').update(`${timestamp}.${bodyHash}`).digest('hex')}`);
    expect((init?.headers as Record<string, string>)['Idempotency-Key']).toBe('evidence:1');
  });
});
