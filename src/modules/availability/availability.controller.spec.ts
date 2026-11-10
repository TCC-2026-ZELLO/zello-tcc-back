import { Test, TestingModule } from '@nestjs/testing';
import { AvailabilityController } from './availability.controller';
import { AvailabilityService } from './availability.service';

describe('AvailabilityController', () => {
  let controller: AvailabilityController;
  let service: any;

  beforeEach(async () => {
    service = {
      getOperatingHours: jest.fn().mockResolvedValue([]),
      createOperatingHour: jest.fn().mockResolvedValue({ id: 'oh1' }),
      createShift: jest.fn().mockResolvedValue({ id: 'sh1' }),
      createException: jest.fn().mockResolvedValue([{ id: 'ex1' }]),
      getExceptions: jest.fn().mockResolvedValue([]),
      deleteException: jest.fn().mockResolvedValue({ success: true }),
      getAvailableBounds: jest.fn().mockResolvedValue([]),
      getShiftsByBusinessProfessional: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AvailabilityController],
      providers: [{ provide: AvailabilityService, useValue: service }],
    }).compile();

    controller = module.get<AvailabilityController>(AvailabilityController);
  });

  it('should be defined and delegate all endpoints', async () => {
    const req = { user: { id: 'u1', email: 'a@b.com', roles: ['manager'] } };
    expect(await controller.getOperatingHours('b1')).toEqual([]);
    expect(await controller.createOperatingHour(req, {} as any)).toEqual({
      id: 'oh1',
    });
    expect(await controller.createShift({} as any)).toEqual({ id: 'sh1' });
    expect(await controller.createException(req, {} as any)).toEqual([
      { id: 'ex1' },
    ]);
    expect(await controller.getExceptions('p1', 'b1', '2026-10-10')).toEqual(
      [],
    );
    expect(await controller.deleteException(req, 'ex1')).toEqual({
      success: true,
    });
    expect(
      await controller.getAvailableBounds('2026-10-10', 'b1', 's1', 'p1'),
    ).toEqual([]);
    expect(await controller.getShifts('bp1')).toEqual([]);
  });
});
