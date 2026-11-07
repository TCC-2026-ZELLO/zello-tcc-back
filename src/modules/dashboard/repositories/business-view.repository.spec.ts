import { Repository } from 'typeorm';
import { BusinessView } from '../entities/business-view.entity';
import { BusinessViewRepository } from './business-view.repository';

describe('BusinessViewRepository', () => {
  const query = jest.fn();
  const repository = new BusinessViewRepository({
    query,
  } as unknown as Repository<BusinessView>);

  beforeEach(() => query.mockReset());

  describe('registerView', () => {
    it('insere de forma idempotente (ON CONFLICT DO NOTHING) no timezone do negócio', async () => {
      query.mockResolvedValue([{ id: 'v1' }]);

      await expect(repository.registerView('b1', 'u1')).resolves.toBe(true);

      const [sql, params] = query.mock.calls[0] as [string, string[]];
      expect(sql).toContain(
        'ON CONFLICT (business_id, viewer_id, view_date) DO NOTHING',
      );
      expect(sql).toContain('now() AT TIME ZONE b.timezone');
      expect(sql).toContain('manager_business');
      expect(params).toEqual(['b1', 'u1']);
    });

    it('retorna false quando a visualização do dia já existe (dedupe) ou o viewer é gestor', async () => {
      query.mockResolvedValue([]);

      await expect(repository.registerView('b1', 'u1')).resolves.toBe(false);
    });
  });

  describe('businessExists', () => {
    it('indica se o estabelecimento existe', async () => {
      query
        .mockResolvedValueOnce([{ '?column?': 1 }])
        .mockResolvedValueOnce([]);

      await expect(repository.businessExists('b1')).resolves.toBe(true);
      await expect(repository.businessExists('b2')).resolves.toBe(false);
    });
  });
});
