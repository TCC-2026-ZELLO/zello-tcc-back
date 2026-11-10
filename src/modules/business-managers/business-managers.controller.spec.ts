import { Test, TestingModule } from '@nestjs/testing';
import { BusinessManagersController } from './business-managers.controller';
import { BusinessManagersService } from './business-managers.service';

describe('BusinessManagersController', () => {
  let controller: BusinessManagersController;
  let service: any;

  beforeEach(async () => {
    service = {
      create: jest.fn().mockResolvedValue({ id: 'bm1' }),
      findAll: jest.fn().mockResolvedValue([]),
      findByBusiness: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({ id: 'bm1' }),
      remove: jest.fn().mockResolvedValue({ message: 'ok' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BusinessManagersController],
      providers: [{ provide: BusinessManagersService, useValue: service }],
    }).compile();

    controller = module.get<BusinessManagersController>(
      BusinessManagersController,
    );
  });

  it('should be defined and delegate all endpoints', async () => {
    const req = { user: { id: 'u1', email: 'a@b.com', roles: ['admin'] } };
    expect(
      await controller.create(req, { managerId: 'm1', businessId: 'b1' }),
    ).toEqual({ id: 'bm1' });
    expect(await controller.findAll()).toEqual([]);
    expect(await controller.findByBusiness('b1')).toEqual([]);
    expect(await controller.findOne('bm1')).toEqual({ id: 'bm1' });
    expect(await controller.remove(req, 'bm1')).toEqual({ message: 'ok' });
  });
});
