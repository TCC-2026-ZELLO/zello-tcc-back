import { Test, TestingModule } from '@nestjs/testing';
import { BusinessProfessionalsController } from './business-professionals.controller';
import { BusinessProfessionalsService } from './business-professionals.service';

describe('BusinessProfessionalsController', () => {
  let controller: BusinessProfessionalsController;
  let service: any;

  beforeEach(async () => {
    service = {
      create: jest.fn().mockResolvedValue({ id: 'bp1' }),
      findAllByBusiness: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({ id: 'bp1' }),
      update: jest.fn().mockResolvedValue({ id: 'bp1' }),
      remove: jest.fn().mockResolvedValue({ message: 'ok' }),
      findProfessionalServices: jest.fn().mockResolvedValue([]),
      updateProfessionalServices: jest.fn().mockResolvedValue([]),
      findProfessionalShifts: jest.fn().mockResolvedValue([]),
      updateProfessionalShifts: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BusinessProfessionalsController],
      providers: [
        { provide: BusinessProfessionalsService, useValue: service },
      ],
    }).compile();

    controller = module.get<BusinessProfessionalsController>(
      BusinessProfessionalsController,
    );
  });

  it('should be defined and delegate all endpoints', async () => {
    const req = { user: { id: 'u1', email: 'a@b.com', roles: ['manager'] } };
    expect(
      await controller.create(req, { email: 'a@b.com', businessId: 'b1' }),
    ).toEqual({ id: 'bp1' });
    expect(await controller.findAllByBusiness('b1')).toEqual([]);
    expect(await controller.findOne('bp1')).toEqual({ id: 'bp1' });
    expect(await controller.update('bp1', { active: true })).toEqual({
      id: 'bp1',
    });
    expect(await controller.remove('bp1')).toEqual({ message: 'ok' });
    expect(await controller.findServices('bp1')).toEqual([]);
    expect(
      await controller.updateServices('bp1', { serviceIds: ['s1'] }),
    ).toEqual([]);
    expect(await controller.findShifts('bp1')).toEqual([]);
    expect(await controller.updateShifts('bp1', { shifts: [] })).toEqual([]);
  });
});
