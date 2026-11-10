import { Test, TestingModule } from '@nestjs/testing';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';

describe('ClientsController', () => {
  let controller: ClientsController;
  let service: any;

  beforeEach(async () => {
    service = {
      create: jest.fn().mockReturnValue('created'),
      findAll: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({ id: 'c1' }),
      update: jest.fn().mockResolvedValue({ id: 'c1' }),
      remove: jest.fn().mockResolvedValue({ message: 'ok' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClientsController],
      providers: [{ provide: ClientsService, useValue: service }],
    }).compile();

    controller = module.get<ClientsController>(ClientsController);
  });

  it('should be defined and delegate all endpoints', async () => {
    expect(controller.create()).toBe('created');
    expect(await controller.findAll()).toEqual([]);
    expect(await controller.findOne('c1')).toEqual({ id: 'c1' });
    expect(await controller.update('c1', {} as any)).toEqual({ id: 'c1' });
    expect(await controller.remove('c1')).toEqual({ message: 'ok' });
  });
});
