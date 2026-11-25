import { LoginThrottleService } from './login-throttle.service';

describe('LoginThrottleService atomic window updates', () => {
  it('uses one atomic PostgreSQL upsert per account/IP key and preserves max-attempt semantics', async () => {
    const prisma = {
      $queryRaw: jest.fn()
        // The fifth account failure is allowed, matching the existing threshold.
        .mockResolvedValueOnce([{ count: 5, blockedUntil: new Date(Date.now() + 60_000) }])
        .mockResolvedValueOnce([{ count: 1, blockedUntil: null }])
        // The next account failure exceeds the limit and is blocked.
        .mockResolvedValueOnce([{ count: 6, blockedUntil: new Date(Date.now() + 60_000) }])
        .mockResolvedValueOnce([{ count: 2, blockedUntil: null }]),
      otpRateLimit: { deleteMany: jest.fn() },
    };
    const service = new LoginThrottleService(prisma as never);

    await expect(service.recordFailure('person@example.test', '192.0.2.1', 'customer'))
      .resolves.toEqual({ blocked: false });
    await expect(service.recordFailure('person@example.test', '192.0.2.1', 'customer'))
      .resolves.toEqual({ blocked: true });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(4);
    for (const [query] of prisma.$queryRaw.mock.calls) {
      expect(query.sql).toContain('ON CONFLICT ("key") DO UPDATE');
      expect(query.sql).toContain('rate_limit."count" + 1');
      expect(query.sql).toContain('windowStartedAt');
    }
  });

  it('uses separate normalized account and surface-specific IP keys', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ count: 1, blockedUntil: null }]) };
    const service = new LoginThrottleService(prisma as never);

    await service.recordFailure(' Person@Example.Test ', '203.0.113.8', 'admin');

    const [accountSql, ipSql] = prisma.$queryRaw.mock.calls.map(([query]) => query);
    expect(accountSql.values).toContain('login:admin:email:person@example.test');
    expect(ipSql.values).toContain('login:admin:ip:203.0.113.8');
  });
});
