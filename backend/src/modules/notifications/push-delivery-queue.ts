import { Prisma } from '@prisma/client';

/** Queue only devices that were active when the notification committed. */
export async function enqueueNotificationPushDeliveries(
  tx: Prisma.TransactionClient,
  userId: string,
  notificationId: string,
): Promise<void> {
  const tokens = await tx.notificationPushToken.findMany({
    where: { userId, isActive: true },
    select: { id: true },
  });
  if (tokens.length === 0) return;

  await tx.notificationPushDelivery.createMany({
    data: tokens.map((token) => ({ notificationId, pushTokenId: token.id })),
    skipDuplicates: true,
  });
}
