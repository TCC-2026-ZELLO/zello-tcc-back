import { Repository } from 'typeorm';
import { BusinessView } from '../entities/business-view.entity';
import { VisibilityRepository } from './visibility.repository';

describe('VisibilityRepository', () => {
  const query = jest.fn();
  const repository = new VisibilityRepository({
    query,
  } as unknown as Repository<BusinessView>);

  beforeEach(() => query.mockReset());

  it('retorna as contagens do funil no período', async () => {
    query.mockResolvedValue([{ views: 10, appointments: 3 }]);

    await expect(
      repository.findFunnel('b1', '2026-10-01', '2026-10-31'),
    ).resolves.toEqual({ views: 10, appointments: 3 });

    const [sql, params] = query.mock.calls[0] as [string, string[]];
    expect(sql).toContain('AT TIME ZONE b.timezone');
    expect(sql).toContain(
      `NOT (a.status = 'CANCELLED' AND a."cancelledByRole" IS NULL)`,
    );
    expect(params).toEqual(['b1', '2026-10-01', '2026-10-31']);
  });

  it('retorna zeros quando a query não devolve linha', async () => {
    query.mockResolvedValue([]);

    await expect(
      repository.findFunnel('b1', '2026-10-01', '2026-10-31'),
    ).resolves.toEqual({ views: 0, appointments: 0 });
  });
});
