import { Test, TestingModule } from '@nestjs/testing';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

describe('SearchController', () => {
  let controller: SearchController;
  let service: any;

  beforeEach(async () => {
    service = {
      searchProfessionals: jest.fn().mockResolvedValue([]),
      getRecommended: jest.fn().mockResolvedValue([]),
      searchBusinesses: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [{ provide: SearchService, useValue: service }],
    }).compile();

    controller = module.get<SearchController>(SearchController);
  });

  it('should be defined and delegate all endpoints', async () => {
    expect(await controller.searchProfessionals({})).toEqual([]);
    expect(await controller.getRecommended()).toEqual([]);
    expect(await controller.searchBusinesses({})).toEqual([]);
  });
});
