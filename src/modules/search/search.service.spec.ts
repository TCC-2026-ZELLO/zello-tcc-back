import { SearchService } from './search.service';
import { SortBy } from './dto/search-query.dto';

describe('SearchService', () => {
  let service: SearchService;
  let proRepo: any;
  let businessRepo: any;
  let proQb: any;
  let busQb: any;

  beforeEach(() => {
    proQb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      having: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getRawAndEntities: jest.fn().mockResolvedValue({
        entities: [
          {
            id: 'p1',
            user: { name: 'Ana' },
            specialty: 'Cabelo',
            photoUrl: 'p.jpg',
            bannerUrl: 'b.jpg',
            averageRating: 4.9,
          },
        ],
        raw: [{ minPrice: '45.5' }],
      }),
    };

    busQb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          id: 'b1',
          tradeName: 'Barbearia Zello',
          photoUrl: 'bp.jpg',
          bannerUrl: 'bb.jpg',
        },
      ]),
    };

    proRepo = { createQueryBuilder: jest.fn().mockReturnValue(proQb) };
    businessRepo = { createQueryBuilder: jest.fn().mockReturnValue(busQb) };
    service = new SearchService(proRepo, businessRepo);
  });

  it('should searchProfessionals with all filter and sort combinations', async () => {
    const res1 = await service.searchProfessionals({
      q: 'Ana',
      minRating: 4,
      minPrice: 20,
      maxPrice: 100,
      sortBy: SortBy.PRICE_ASC,
      limit: 10,
    });
    expect(res1[0].minPrice).toBe(45.5);

    await service.searchProfessionals({ minPrice: 20, sortBy: SortBy.TRENDING });
    await service.searchProfessionals({ maxPrice: 100 });
    await service.getRecommended(4);
    expect(proQb.getRawAndEntities).toHaveBeenCalledTimes(4);
  });

  it('should searchBusinesses with and without query string', async () => {
    const res = await service.searchBusinesses({ q: 'Barbearia', limit: 5 });
    expect(res[0].name).toBe('Barbearia Zello');
    await service.searchBusinesses({});
  });
});
