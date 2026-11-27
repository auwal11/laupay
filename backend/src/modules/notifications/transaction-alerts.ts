import { Prisma } from '@prisma/client';
import { enqueueNotificationPushDeliveries } from './push-delivery-queue';

export type TransactionAlertType =
  | 'CREDIT'
  | 'DEBIT'
  | 'REVERSAL'
  | 'REFUND'
  | 'PURCHASE_SUCCESS'
  | 'PURCHASE_FAILED'
  | 'PURCHASE_PENDING'
  | 'STATUS_UPDATE';

export interface TransactionAlertEmailPayload {
  alertType: TransactionAlertType;
  title: string;
  body: string;
  fullName: string;
  amount: string;
  currency: string;
  transactionReference: string;
  status: string;
  date: string;
  narrative?: string;
  availableBalance?: string;
  balanceBefore?: string;
  originalReference?: string;
  originalTransactionId?: string;
  recipient?: string;
  service?: string;
  supportEmail: string;
}

export interface PersistTransactionAlertInput {
  eventKey: string;
  userId: string;
  title: string;
  body: string;
  category: 'wallet' | 'order';
  metadata: Record<string, unknown>;
  email: Omit<TransactionAlertEmailPayload, 'fullName'>;
}

/**
 * Insert the user-facing notification and durable email intent together with
 * the business event. If the transaction rolls back, neither becomes visible;
 * eventKey uniqueness prevents duplicate feed rows or email work on replay.
 */
export async function persistTransactionAlert(
  tx: Prisma.TransactionClient,
  input: PersistTransactionAlertInput,
): Promise<void> {
  const user = await tx.user.findUnique({
    where: { id: input.userId },
    select: { id: true, email: true, fullName: true },
  });
  if (!user) return;

  const metadata = jsonValue(input.metadata);
  const notificationResult = await tx.notification.createMany({
    data: [{
      userId: user.id,
      eventKey: input.eventKey,
      category: input.category,
      title: input.title,
      body: input.body,
      metadata,
    }],
    skipDuplicates: true,
  });
  if (notificationResult.count === 0) return;

  const notification = await tx.notification.findUnique({
    where: { eventKey: input.eventKey },
    select: { id: true },
  });
  if (notification) await enqueueNotificationPushDeliveries(tx, user.id, notification.id);

  const payload: TransactionAlertEmailPayload = {
    ...input.email,
    fullName: user.fullName,
  };
  await tx.transactionAlertOutbox.create({
    data: {
      eventKey: input.eventKey,
      userId: user.id,
      recipientEmail: user.email,
      payload: jsonValue(payload),
    },
  });
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
