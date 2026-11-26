import { CatalogService } from './catalog.service';

describe('CatalogService public projections', () => {
  it('omits internal network pricing metadata from populated and fallback results', async () => {
    const prisma = {
      network: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'network-1', code: 'MTN', name: 'MTN', agentDiscountPercent: 17, privateSentinel: 'NETWORK_INTERNAL' },
        ]),
      },
    };
    const service = new CatalogService(prisma as never, {} as never, {} as never);

    const result = await service.listNetworks();

    expect(prisma.network.findMany).toHaveBeenCalledWith(expect.objectContaining({
      select: { id: true, code: true, name: true },
    }));
    expect(result).toEqual([{ id: 'network-1', code: 'MTN', name: 'MTN' }]);
    expect(JSON.stringify(result)).not.toContain('NETWORK_INTERNAL');
    expect(JSON.stringify(result)).not.toContain('agentDiscountPercent');
  });

  it('returns only public data-plan fields even if persistence returns extra columns', async () => {
    const prisma = {
      network: {
        upsert: jest.fn().mockResolvedValue({ id: 'network-1', code: 'MTN', name: 'MTN' }),
      },
      dataPlan: {
        upsert: jest.fn().mockResolvedValue(undefined),
        findMany: jest.fn().mockResolvedValue([{
          id: 'vtpass:MTN:plan-1',
          networkId: 'network-1',
          label: '1 GB',
          priceNaira: { toString: () => '500' },
          validityDays: 30,
          costNaira: '300',
          agentPriceNaira: '450',
          agentDiscountPercent: 10,
        }]),
      },
    };
    const provider = { listDataPlans: jest.fn().mockResolvedValue([{
      externalCode: 'plan-1', label: '1 GB', costNaira: 500, validityDays: 30,
    }]) };
    const service = new CatalogService(prisma as never, provider as never, { vtuProvider: 'vtpass' } as never);

    const result = await service.listDataPlans('MTN');

    expect(prisma.dataPlan.findMany).toHaveBeenCalledWith(expect.objectContaining({
      select: { id: true, networkId: true, label: true, priceNaira: true, validityDays: true },
    }));
    expect(result).toEqual([{
      id: 'vtpass:MTN:plan-1', networkId: 'network-1', label: '1 GB',
      priceNaira: expect.anything(), validityDays: 30,
    }]);
    expect(JSON.stringify(result)).not.toContain('costNaira');
    expect(JSON.stringify(result)).not.toContain('agentPriceNaira');
    expect(JSON.stringify(result)).not.toContain('agentDiscountPercent');
  });

  it('rejects unsupported network codes before querying the provider or writing catalog rows', async () => {
    const provider = { listDataPlans: jest.fn() };
    const network = { upsert: jest.fn() };
    const dataPlan = { upsert: jest.fn(), findMany: jest.fn() };
    const service = new CatalogService({ network, dataPlan } as never, provider as never, { vtuProvider: 'vtpass' } as never);

    await expect(service.listDataPlans('../../admin')).rejects.toMatchObject({ status: 400 });
    expect(provider.listDataPlans).not.toHaveBeenCalled();
    expect(network.upsert).not.toHaveBeenCalled();
    expect(dataPlan.upsert).not.toHaveBeenCalled();
  });
});
