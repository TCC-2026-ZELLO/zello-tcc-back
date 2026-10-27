import { Test, TestingModule } from '@nestjs/testing';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

describe('CatalogController', () => {
  let controller: CatalogController;
  let service: any;

  beforeEach(async () => {
    service = {
      create: jest.fn().mockResolvedValue({ id: 's1' }),
      findAllByBusiness: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({ id: 's1' }),
      update: jest.fn().mockResolvedValue({ id: 's1' }),
      remove: jest.fn().mockResolvedValue({ message: 'ok' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CatalogController],
      providers: [{ provide: CatalogService, useValue: service }],
    }).compile();

    controller = module.get<CatalogController>(CatalogController);
  });

  it('should be defined and delegate all endpoints', async () => {
    expect(
      await controller.create({ user: { id: 'u1' } }, 'b1', {} as any),
    ).toEqual({ id: 's1' });
    expect(await controller.findAllByBusiness('b1')).toEqual([]);
    expect(await controller.findOne('s1')).toEqual({ id: 's1' });
    expect(await controller.update('s1', {} as any)).toEqual({ id: 's1' });
    expect(await controller.remove('s1')).toEqual({ message: 'ok' });
  });
});
