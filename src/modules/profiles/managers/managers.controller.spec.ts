import { Test, TestingModule } from '@nestjs/testing';
import { ManagersController } from './managers.controller';
import { ManagersService } from './managers.service';

describe('ManagersController', () => {
  let controller: ManagersController;
  let service: any;

  beforeEach(async () => {
    service = {
      create: jest.fn().mockReturnValue('created'),
      findAll: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({ id: 'm1' }),
      update: jest.fn().mockReturnValue('updated'),
      remove: jest.fn().mockResolvedValue({ message: 'ok' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ManagersController],
      providers: [{ provide: ManagersService, useValue: service }],
    }).compile();

    controller = module.get<ManagersController>(ManagersController);
  });

  it('should be defined and delegate all endpoints', async () => {
    expect(controller.create()).toBe('created');
    expect(await controller.findAll()).toEqual([]);
    expect(await controller.findOne('m1')).toEqual({ id: 'm1' });
    expect(controller.update('m1')).toBe('updated');
    expect(await controller.remove('m1')).toEqual({ message: 'ok' });
  });
});
