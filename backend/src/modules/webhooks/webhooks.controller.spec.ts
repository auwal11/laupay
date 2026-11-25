import { createHmac } from 'crypto';
import { WebhooksController } from './webhooks.controller';

function signature(body: Buffer, secret: string): string {
  return createHmac('sha512', secret).update(body).digest('hex');
}

describe('WebhooksController provider callbacks', () => {
  const paystackSecret = 'paystack-test-webhook-secret';
  const config = {
    nodeEnv: 'production',
    paystackWebhookSecret: paystackSecret,
    monnifySecretKey: '',
  } as any;

  it('returns Paystack challenge text with a plain-text content type', () => {
    const controller = new WebhooksController(config, {} as any, {} as any, {} as any, {} as any);
    const res = {
      status: jest.fn().mockReturnThis(),
      type: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnValue('sent'),
    };
    const markup = '<b>challenge</b>';

    expect(controller.challenge({ query: { challenge: markup } } as any, res as any)).toBe('sent');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.type).toHaveBeenCalledWith('text/plain');
    expect(res.send).toHaveBeenCalledWith(markup);
  });

  it('retains the missing-challenge 400 behavior', () => {
    const controller = new WebhooksController(config, {} as any, {} as any, {} as any, {} as any);
    const res = { status: jest.fn().mockReturnThis(), send: jest.fn().mockReturnValue('sent') };

    controller.challenge({ query: {} } as any, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({ message: 'Missing challenge' });
  });

  it('accepts a documented Paystack payload signed over the exact raw bytes', async () => {
    const body = Buffer.from('{"event":"charge.success","data":{"id":123,"reference":"LAU_123","status":"success"}}');
    const payment = { id: 'payment-1', providerReference: 'LAU_123' };
    const prisma = {
      payment: { findUnique: jest.fn().mockResolvedValue(payment) },
      paymentEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const payments = { requeryPayment: jest.fn().mockResolvedValue(undefined) };
    const controller = new WebhooksController(config, prisma as any, payments as any, {} as any, {} as any);

    await expect(controller.handlePaymentWebhook(
      { rawBody: body } as any,
      signature(body, paystackSecret),
      undefined,
      undefined,
      JSON.parse(body.toString()),
    )).resolves.toEqual({ status: 'accepted' });
    expect(payments.requeryPayment).toHaveBeenCalledWith(payment.id);
  });

  it('rejects a Paystack signature made from altered bytes', async () => {
    const body = Buffer.from('{"event":"charge.success","data":{"id":123,"reference":"LAU_123"}}');
    const controller = new WebhooksController(config, {} as any, {} as any, {} as any, {} as any);
    await expect(controller.handlePaymentWebhook(
      { rawBody: Buffer.from('{ "event":"charge.success","data":{"id":123,"reference":"LAU_123"}}') } as any,
      signature(body, paystackSecret),
      undefined,
      undefined,
      JSON.parse(body.toString()),
    )).rejects.toThrow('Invalid webhook signature');
  });

  it('ignores a duplicate Paystack event without reprocessing it', async () => {
    const body = Buffer.from('{"event":"charge.success","data":{"id":456,"reference":"LAU_DUP"}}');
    const prisma = {
      payment: { findUnique: jest.fn().mockResolvedValue({ id: 'payment-2' }) },
      paymentEvent: { create: jest.fn().mockRejectedValue({ code: 'P2002' }) },
    };
    const payments = { requeryPayment: jest.fn() };
    const controller = new WebhooksController(config, prisma as any, payments as any, {} as any, {} as any);
    await expect(controller.handlePaymentWebhook(
      { rawBody: body } as any,
      signature(body, paystackSecret),
      undefined,
      undefined,
      JSON.parse(body.toString()),
    )).resolves.toEqual({ status: 'ignored_duplicate' });
    expect(payments.requeryPayment).not.toHaveBeenCalled();
  });

  it('accepts the documented VTpass transaction-update payload and re-queries server-side', async () => {
    const prisma = {
      vtuTransaction: { findUnique: jest.fn().mockResolvedValue({ id: 'vtu-1', providerReference: 'VT-123' }) },
    };
    const orders = { reconcileVtuTransaction: jest.fn().mockResolvedValue(undefined) };
    const controller = new WebhooksController(config, prisma as any, {} as any, orders as any, {} as any);
    const payload = {
      type: 'transaction-update',
      data: {
        code: '000',
        content: { transactions: { status: 'delivered', transactionId: 'VT-123' } },
        requestId: 'LAU_REQUEST_123',
        response_description: 'TRANSACTION DELIVERED',
      },
    };

    await expect(controller.handleVtuWebhook(payload)).resolves.toEqual({ response: 'success' });
    expect(orders.reconcileVtuTransaction).toHaveBeenCalledWith('vtu-1');
  });

  it('rejects a VTpass callback without the documented transaction id', async () => {
    const controller = new WebhooksController(config, { vtuTransaction: { findUnique: jest.fn() } } as any, {} as any, {} as any, {} as any);
    await expect(controller.handleVtuWebhook({ type: 'transaction-update', data: { content: { transactions: { status: 'delivered' } } } }))
      .rejects.toThrow('Missing VTpass transactionId');
  });

  describe('Monnify callbacks', () => {
    const monnifySecret = 'monnify-test-secret';
    const monnifyConfig = {
      nodeEnv: 'production',
      paystackWebhookSecret: '',
      monnifySecretKey: monnifySecret,
    } as any;

    const monnifyPayload = (reference: string, txRef: string) =>
      Buffer.from(
        JSON.stringify({
          eventType: 'SUCCESSFUL_TRANSACTION',
          eventData: { paymentReference: reference, transactionReference: txRef, paymentStatus: 'PAID', amountPaid: 100 },
        }),
      );

    it('accepts a Monnify payload signed over the exact raw bytes and re-queries server-side', async () => {
      const body = monnifyPayload('LAU_MON', 'MON_TX_1');
      const payment = { id: 'payment-mon', providerReference: 'LAU_MON' };
      const prisma = {
        payment: { findUnique: jest.fn().mockResolvedValue(payment) },
        paymentEvent: { create: jest.fn().mockResolvedValue({}) },
      };
      const payments = { requeryPayment: jest.fn().mockResolvedValue(undefined) };
      const controller = new WebhooksController(monnifyConfig, prisma as any, payments as any, {} as any, {} as any);

      await expect(
        controller.handlePaymentWebhook(
          { rawBody: body } as any,
          undefined,
          signature(body, monnifySecret),
          undefined,
          JSON.parse(body.toString()),
        ),
      ).resolves.toEqual({ status: 'accepted' });

      expect(prisma.paymentEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ provider: 'monnify', providerEventId: 'SUCCESSFUL_TRANSACTION:MON_TX_1' }),
        }),
      );
      expect(payments.requeryPayment).toHaveBeenCalledWith(payment.id);
    });

    it('ignores a duplicate Monnify event', async () => {
      const body = monnifyPayload('LAU_MON', 'MON_TX_2');
      const prisma = {
        payment: { findUnique: jest.fn().mockResolvedValue({ id: 'payment-mon2' }) },
        paymentEvent: { create: jest.fn().mockRejectedValue({ code: 'P2002' }) },
      };
      const payments = { requeryPayment: jest.fn() };
      const controller = new WebhooksController(monnifyConfig, prisma as any, payments as any, {} as any, {} as any);

      await expect(
        controller.handlePaymentWebhook(
          { rawBody: body } as any,
          undefined,
          signature(body, monnifySecret),
          undefined,
          JSON.parse(body.toString()),
        ),
      ).resolves.toEqual({ status: 'ignored_duplicate' });
      expect(payments.requeryPayment).not.toHaveBeenCalled();
    });

    it('rejects a Monnify payload with a bad signature', async () => {
      const body = monnifyPayload('LAU_MON', 'MON_TX_3');
      const controller = new WebhooksController(monnifyConfig, {} as any, {} as any, {} as any, {} as any);
      await expect(
        controller.handlePaymentWebhook(
          { rawBody: body } as any,
          undefined,
          signature(body, 'wrong-secret'),
          undefined,
          JSON.parse(body.toString()),
        ),
      ).rejects.toThrow('Invalid webhook signature');
    });
  });
});
