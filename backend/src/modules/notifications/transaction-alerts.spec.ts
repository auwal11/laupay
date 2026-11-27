import { persistTransactionAlert } from './transaction-alerts';
import { transactionAlertEmail } from '../../common/mail/email-templates';
import { TransactionAlertDeliveryService } from './transaction-alert-delivery.service';
import { WithdrawalsService } from '../withdrawals/withdrawals.service';
import { LedgerService } from '../ledger/ledger.service';

function makeTx(notificationCount = 1, activeTokens: Array<{ id: string }> = []) {
  return {
    user: { findUnique: jest.fn().mockResolvedValue({ id: 'user-1', email: 'user@example.test', fullName: 'Test Customer' }) },
    notification: {
      createMany: jest.fn().mockResolvedValue({ count: notificationCount }),
      findUnique: jest.fn().mockResolvedValue({ id: 'notification-1' }),
    },
    notificationPushToken: { findMany: jest.fn().mockResolvedValue(activeTokens) },
    notificationPushDelivery: { createMany: jest.fn().mockResolvedValue({ count: activeTokens.length }) },
    transactionAlertOutbox: { create: jest.fn().mockResolvedValue({}) },
  };
}

const alertInput = {
  eventKey: 'ledger:entry-1',
  userId: 'user-1',
  title: 'Wallet debited',
  body: 'NGN 100.00 was debited from your wallet.',
  category: 'wallet' as const,
  metadata: { transactionReference: 'TX-1', amount: '100.00' },
  email: {
    alertType: 'DEBIT' as const,
    title: 'Wallet debited',
    body: 'NGN 100.00 was debited from your wallet.',
    amount: '100.00',
    currency: 'NGN',
    transactionReference: 'TX-1',
    status: 'POSTED',
    date: '2026-11-26T00:00:00.000Z',
    supportEmail: 'support@example.test',
  },
};

describe('persistTransactionAlert', () => {
  it('writes the in-app notification and durable email/push intents in the same transaction', async () => {
    const tx = makeTx(1, [{ id: 'device-1' }, { id: 'device-2' }]);
    await persistTransactionAlert(tx as never, alertInput);

    expect(tx.notification.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({ eventKey: alertInput.eventKey, userId: 'user-1' })],
      skipDuplicates: true,
    }));
    expect(tx.notificationPushToken.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', isActive: true }, select: { id: true },
    });
    expect(tx.notificationPushDelivery.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [
        { notificationId: 'notification-1', pushTokenId: 'device-1' },
        { notificationId: 'notification-1', pushTokenId: 'device-2' },
      ],
      skipDuplicates: true,
    }));
    expect(tx.transactionAlertOutbox.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        eventKey: alertInput.eventKey,
        userId: 'user-1',
        recipientEmail: 'user@example.test',
        payload: expect.objectContaining({ fullName: 'Test Customer', transactionReference: 'TX-1' }),
      }),
    }));
  });

  it('does not enqueue duplicate email or push work when notification deduplication finds an existing event', async () => {
    const tx = makeTx(0, [{ id: 'device-1' }]);
    await persistTransactionAlert(tx as never, alertInput);
    expect(tx.transactionAlertOutbox.create).not.toHaveBeenCalled();
    expect(tx.notificationPushToken.findMany).not.toHaveBeenCalled();
    expect(tx.notificationPushDelivery.createMany).not.toHaveBeenCalled();
  });

  it('does not enqueue work for a deleted or missing recipient', async () => {
    const tx = makeTx();
    tx.user.findUnique.mockResolvedValue(null);
    await persistTransactionAlert(tx as never, alertInput);
    expect(tx.notification.createMany).not.toHaveBeenCalled();
    expect(tx.notificationPushToken.findMany).not.toHaveBeenCalled();
    expect(tx.transactionAlertOutbox.create).not.toHaveBeenCalled();
  });
});

describe('transactionAlertEmail', () => {
  it('escapes user-controlled and provider-controlled fields in the HTML and links original/reversal references', () => {
    const rendered = transactionAlertEmail({
      fullName: '<script>alert(1)</script>',
      alertType: 'REVERSAL',
      title: '<img src=x onerror=alert(1)>',
      body: '<b>unsafe provider response</b>',
      amount: '10.00',
      currency: 'NGN',
      transactionReference: 'REV-1',
      originalReference: 'ORIG-1 & <bad>',
      originalTransactionId: 'ledger-original-1',
      status: 'POSTED',
      date: '2026-11-26T00:00:00.000Z',
      narrative: 'Refund <approved>',
      supportEmail: 'help@example.test?x=<script>',
    });
    expect(rendered.html).toContain('&lt;script&gt;');
    expect(rendered.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(rendered.html).toContain('ORIG-1 &amp; &lt;bad&gt;');
    expect(rendered.html).not.toContain('<script>');
    expect(rendered.html).not.toContain('<b>unsafe provider response</b>');
    expect(rendered.html).toContain('Original reference');
    expect(rendered.html).toContain('Original transaction');
  });
});

describe('TransactionAlertDeliveryService', () => {
  const payload = {
    alertType: 'DEBIT', title: 'Wallet debited', body: 'Debit', fullName: 'Customer', amount: '10.00',
    currency: 'NGN', transactionReference: 'TX-2', status: 'POSTED', date: new Date().toISOString(),
    supportEmail: 'support@example.test',
  };

  function makeDelivery(config = { isProduction: false, mailProvider: 'mock' }) {
    const prisma = { transactionAlertOutbox: { update: jest.fn().mockResolvedValue({}) } };
    const mail = { sendTransactionAlert: jest.fn().mockResolvedValue(undefined) };
    const service = new TransactionAlertDeliveryService(prisma as never, config as never, mail as never);
    const row = {
      id: 'f9bd2d20-c716-4605-b109-8fa1f92ab856',
      recipientEmail: 'user@example.test',
      payload,
      attempts: 1,
      createdAt: new Date(),
      firstAttemptAt: new Date(),
    };
    return { service, prisma, mail, row };
  }

  it('uses the immutable outbox id as the email idempotency key and marks accepted delivery sent', async () => {
    const { service, prisma, mail, row } = makeDelivery();
    await (service as any).deliver(row);
    expect(mail.sendTransactionAlert).toHaveBeenCalledWith(expect.objectContaining({
      to: 'user@example.test', idempotencyKey: row.id, transactionReference: 'TX-2',
    }));
    expect(prisma.transactionAlertOutbox.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: row.id }, data: expect.objectContaining({ status: 'SENT', sentAt: expect.any(Date) }),
    }));
  });

  it('schedules transient retries without recording raw provider error text', async () => {
    const { service, prisma, mail, row } = makeDelivery();
    mail.sendTransactionAlert.mockRejectedValue(new Error('secret-provider-response'));
    await (service as any).deliver(row);
    const update = prisma.transactionAlertOutbox.update.mock.calls[0][0];
    expect(update.data.status).toBe('PENDING');
    expect(update.data.nextAttemptAt).toBeInstanceOf(Date);
    expect(update.data.lastError).not.toContain('secret-provider-response');
  });

  it('moves ambiguous sends to manual review before the provider idempotency window expires', async () => {
    const { service, prisma, mail, row } = makeDelivery();
    row.firstAttemptAt = new Date(Date.now() - 26 * 60_000);
    mail.sendTransactionAlert.mockRejectedValue(new Error('timeout'));
    await (service as any).deliver(row);
    expect(prisma.transactionAlertOutbox.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: row.id }, data: expect.objectContaining({ status: 'REVIEW', lockedAt: null }),
    }));
  });

  it('never sends mock mail from the production worker', async () => {
    const { service, prisma, mail, row } = makeDelivery({ isProduction: true, mailProvider: 'mock' });
    await (service as any).deliver(row);
    expect(mail.sendTransactionAlert).not.toHaveBeenCalled();
    expect(prisma.transactionAlertOutbox.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'REVIEW' }),
    }));
  });
});

describe('withdrawal status notifications', () => {
  it('persists approved-status notification and email intent under a deterministic status event key', async () => {
    const tx = makeTx();
    const service = new WithdrawalsService({} as never, {} as never, {} as never, { supportEmail: 'support@example.test' } as never);
    await (service as any).persistStatusAlert(
      tx as never,
      { id: 'withdrawal-1', userId: 'user-1', reference: 'WD-100', amount: { toFixed: () => '100.00' }, updatedAt: new Date('2026-11-26T00:00:00.000Z') },
      'APPROVED',
      'admin-1',
      'Verified request',
    );
    expect(tx.notification.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({ eventKey: 'withdrawal:withdrawal-1:status:APPROVED' })],
    }));
    expect(tx.transactionAlertOutbox.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        payload: expect.objectContaining({ alertType: 'STATUS_UPDATE', status: 'APPROVED' }),
      }),
    }));
  });
});

describe('ledger/order alert deduplication', () => {
  it('creates a credit alert and email intent for an admin test credit', async () => {
    const tx = makeTx();
    const service = new LedgerService({} as never);
    await (service as any).persistLedgerAlert(
      tx as never,
      {
        id: 'ledger-credit-1',
        amount: { toFixed: () => '100.00' },
        createdAt: new Date('2026-11-27T00:00:00.000Z'),
        direction: 'CREDIT',
        referenceType: 'AdminAdjustment',
        referenceId: 'admin-credit-1',
        adminId: 'admin-1',
      },
      { ownerId: 'user-1', ownerType: 'USER', currency: 'NGN', balance: { toFixed: () => '0.00' } },
      {
        reason: 'ADMIN_ADJUSTMENT',
        direction: 'CREDIT',
        source: 'admin_test_credit',
        mode: 'test',
        narrative: 'Test credit — Ibrahim Lau Provision Shop',
        referenceType: 'AdminAdjustment',
        referenceId: 'admin-credit-1',
      },
      { toFixed: () => '100.00' },
    );
    expect(tx.notification.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({ eventKey: 'ledger:ledger-credit-1', title: 'Wallet credited' })],
    }));
    expect(tx.transactionAlertOutbox.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ eventKey: 'ledger:ledger-credit-1', recipientEmail: 'user@example.test' }),
    }));
  });

  it('suppresses the duplicate ledger notification for order reversals handled by the order-status alert', async () => {
    const tx = makeTx();
    const service = new LedgerService({} as never);
    await (service as any).persistLedgerAlert(
      tx as never,
      {} as never,
      { ownerType: 'USER' } as never,
      { reason: 'REVERSAL', direction: 'CREDIT', source: 'order_reversal' } as never,
      {} as never,
    );
    expect(tx.user.findUnique).not.toHaveBeenCalled();
    expect(tx.notification.createMany).not.toHaveBeenCalled();
    expect(tx.transactionAlertOutbox.create).not.toHaveBeenCalled();
  });
});
