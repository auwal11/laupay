import { OrdersService } from './orders.service';

function serviceWith(overrides: Record<string, any> = {}) {
  const prisma = {
    $transaction: jest.fn(),
    vtuTransaction: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    order: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      updateMany: jest.fn(),
    },
    ...overrides,
  };
  const vtu = { requeryTransaction: jest.fn() };
  const risk = { assertCanTransact: jest.fn() };
  const service = new OrdersService(
    prisma as never,
    {} as never,
    vtu as never,
    {} as never,
    { fulfillmentMode: 'live' } as never,
    {} as never,
    risk as never,
  );
  return { service, prisma, vtu, risk };
}

describe('OrdersService security invariants', () => {
  it('locks the user, checks quotas, and inserts the order in one transaction', async () => {
    const calls: string[] = [];
    const tx = {
      $queryRaw: jest.fn(async () => { calls.push('lock'); return []; }),
      order: { create: jest.fn(async ({ data }) => { calls.push('insert'); return { id: 'order-1', ...data }; }) },
    };
    const { service, prisma, risk } = serviceWith({
      $transaction: jest.fn(async (callback: (db: unknown) => Promise<unknown>) => callback(tx)),
    });
    risk.assertCanTransact.mockImplementation(async (_context: unknown, database: unknown) => {
      calls.push('quota');
      expect(database).toBe(tx);
    });

    const result = await (service as any).reserveQuotaAndCreateOrder(
      { userId: 'user-1', kind: 'airtime', amount: 100, phoneNumber: '08012345678' },
      { userId: 'user-1', type: 'AIRTIME', status: 'CREATED', amount: 100, idempotencyKey: 'idem-1' },
    );

    expect(result.id).toBe('order-1');
    expect(calls).toEqual(['lock', 'quota', 'insert']);
    const queryCalls = tx.$queryRaw.mock.calls as unknown as Array<[TemplateStringsArray, ...unknown[]]>;
    expect(queryCalls[0]?.[0].join('')).toContain('FOR NO KEY UPDATE');
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ timeout: expect.any(Number) }));
  });

  it('does not re-query the provider when the order is already terminal', async () => {
    const { service, prisma, vtu } = serviceWith();
    prisma.vtuTransaction.findUnique.mockResolvedValue({ id: 'vtu-1', orderId: 'order-1', status: 'UNKNOWN' });
    prisma.order.findUnique.mockResolvedValue({ id: 'order-1', status: 'FULFILLED' });

    await expect(service.reconcileVtuTransaction('vtu-1')).resolves.toEqual({ id: 'order-1', status: 'FULFILLED' });
    expect(vtu.requeryTransaction).not.toHaveBeenCalled();
    expect(prisma.vtuTransaction.updateMany).not.toHaveBeenCalled();
  });

  it('coalesces concurrent provider re-queries behind the database lease', async () => {
    const unresolvedOrder = { id: 'order-1', status: 'FULFILLMENT_UNKNOWN' };
    let claimAttempts = 0;
    let finishRequery!: (value: { status: string }) => void;
    const delayedRequery = new Promise<{ status: string }>((resolve) => { finishRequery = resolve; });
    const { service, prisma, vtu } = serviceWith();
    prisma.vtuTransaction.findUnique.mockResolvedValue({ id: 'vtu-1', orderId: 'order-1', status: 'UNKNOWN' });
    prisma.vtuTransaction.updateMany.mockImplementation(async ({ where }: any) => {
      if (where.reconcileLeaseToken) return { count: 1 };
      claimAttempts += 1;
      return { count: claimAttempts === 1 ? 1 : 0 };
    });
    prisma.order.findUnique.mockResolvedValue(unresolvedOrder);
    prisma.order.findUniqueOrThrow.mockResolvedValue(unresolvedOrder);
    prisma.order.updateMany.mockResolvedValue({ count: 0 });
    vtu.requeryTransaction.mockReturnValue(delayedRequery);

    const first = service.reconcileVtuTransaction('vtu-1');
    await new Promise((resolve) => setImmediate(resolve));
    const second = await service.reconcileVtuTransaction('vtu-1');
    expect(vtu.requeryTransaction).toHaveBeenCalledTimes(1);
    expect(second).toBeNull();

    finishRequery({ status: 'UNKNOWN' });
    await expect(first).resolves.toEqual(unresolvedOrder);
    expect(vtu.requeryTransaction).toHaveBeenCalledTimes(1);
    expect(claimAttempts).toBe(2);
    expect(prisma.vtuTransaction.updateMany).toHaveBeenCalledTimes(4);
  });

  it('does not fail or refund a stale order when another worker owns its reconciliation lease', async () => {
    const staleOrder = {
      id: 'order-1',
      userId: 'user-1',
      status: 'FULFILLMENT_UNKNOWN',
      vtuTransaction: { id: 'vtu-1', status: 'UNKNOWN' },
    };
    const { service, prisma, vtu } = serviceWith();
    prisma.order.findMany.mockResolvedValue([staleOrder]);
    prisma.vtuTransaction.findUnique.mockResolvedValue({ id: 'vtu-1', orderId: 'order-1', status: 'UNKNOWN' });
    prisma.vtuTransaction.updateMany.mockResolvedValue({ count: 0 });
    const failOrder = jest.spyOn(service as any, 'failOrder').mockResolvedValue({ id: 'order-1', status: 'REFUNDED' });

    await expect(service.resolveStaleOrders(5)).resolves.toBe(1);

    expect(vtu.requeryTransaction).not.toHaveBeenCalled();
    expect(failOrder).not.toHaveBeenCalled();
    expect(prisma.order.updateMany).not.toHaveBeenCalled();
  });
});
