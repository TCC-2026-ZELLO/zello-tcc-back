import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  PreconditionFailedException,
} from '@nestjs/common';
import { AvailabilityService } from './availability.service';

describe('AvailabilityService', () => {
  let service: AvailabilityService;
  let operatingHourRepo: any;
  let shiftRepo: any;
  let exceptionRepo: any;
  let bmRepo: any;
  let managerRepo: any;
  let profRepo: any;
  let businessRepo: any;
  let catalogService: any;
  let appointmentsService: any;
  let shiftQb: any;

  beforeEach(() => {
    shiftQb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };

    operatingHourRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      merge: jest.fn(),
      create: jest.fn().mockImplementation((d) => d),
      save: jest.fn().mockImplementation(async (d) => d),
    };

    shiftRepo = {
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation((d) => d),
      save: jest.fn().mockImplementation(async (d) => d),
      remove: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn().mockReturnValue(shiftQb),
      manager: {
        findOne: jest.fn(),
      },
    };

    exceptionRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((d) => d),
      save: jest.fn().mockImplementation(async (d) => d),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    bmRepo = { findOne: jest.fn().mockResolvedValue({ id: 'bm1' }) };
    managerRepo = { findOne: jest.fn().mockResolvedValue({ id: 'm1' }) };
    profRepo = { findOne: jest.fn().mockResolvedValue({ id: 'p1' }) };
    businessRepo = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 'b1', timezone: 'America/Sao_Paulo' }),
    };
    catalogService = {
      getServiceDuration: jest.fn().mockResolvedValue({ totalTime: 60 }),
    };
    appointmentsService = {
      getBusySlotsByDate: jest.fn().mockResolvedValue([]),
      cancelAppointment: jest.fn().mockResolvedValue(undefined),
    };

    service = new AvailabilityService(
      operatingHourRepo,
      shiftRepo,
      exceptionRepo,
      bmRepo,
      managerRepo,
      profRepo,
      businessRepo,
      catalogService,
      appointmentsService,
    );
  });

  it('should get and create operating hours (open and closed)', async () => {
    await service.getOperatingHours('b1');
    expect(operatingHourRepo.find).toHaveBeenCalled();

    operatingHourRepo.findOne.mockResolvedValue(null);
    shiftQb.getMany.mockResolvedValue([
      { id: 's1', startTime: '08:00:00', endTime: '18:00:00' },
    ]);

    const savedOpen = await service.createOperatingHour(
      {
        businessId: 'b1',
        dayOfWeek: 1,
        startTime: '09:00:00',
        endTime: '17:00:00',
        isOpen: true,
      },
      { id: 'u1', email: 'a@b.com', roles: ['manager'] },
    );
    expect(savedOpen.isOpen).toBe(true);
    expect(shiftRepo.save).toHaveBeenCalled();

    operatingHourRepo.findOne.mockResolvedValue({ id: 'oh1' });
    await service.createOperatingHour(
      {
        businessId: 'b1',
        dayOfWeek: 1,
        startTime: '09:00:00',
        endTime: '17:00:00',
        isOpen: false,
      },
      { id: 'u1', email: 'a@b.com', roles: ['manager'] },
    );
    expect(shiftRepo.remove).toHaveBeenCalled();
  });

  it('should createShift and validate business operating hours', async () => {
    shiftRepo.manager.findOne.mockResolvedValue(null);
    await expect(
      service.createShift({
        businessProfessionalId: 'bp1',
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '17:00',
      }),
    ).rejects.toThrow(BadRequestException);

    shiftRepo.manager.findOne.mockResolvedValue({
      id: 'bp1',
      business: { id: 'b1' },
    });
    operatingHourRepo.findOne.mockResolvedValue({ isOpen: false });
    await expect(
      service.createShift({
        businessProfessionalId: 'bp1',
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '17:00',
      }),
    ).rejects.toThrow(BadRequestException);

    operatingHourRepo.findOne.mockResolvedValue({
      isOpen: true,
      startTime: '09:00:00',
      endTime: '18:00:00',
    });
    const shift = await service.createShift({
      businessProfessionalId: 'bp1',
      dayOfWeek: 1,
      startTime: '08:00',
      endTime: '17:00',
    });
    expect(shift.startTime).toBe('09:00:00');
    expect(shift.endTime).toBe('17:00:00');
  });

  it('should createException, getExceptions, and deleteException', async () => {
    await expect(
      service.createException({} as any, {
        id: 'u1',
        email: 'a@b.com',
        roles: ['professional'],
      }),
    ).rejects.toThrow(BadRequestException);

    appointmentsService.getBusySlotsByDate.mockResolvedValue([
      { id: 'a1', startTime: '10:00', endTime: '11:00', status: 'PENDING' },
    ]);

    await expect(
      service.createException(
        {
          professionalId: 'p1',
          dates: ['2099-05-01', '2099-05-02'],
          startTime: '09:00',
          endTime: '12:00',
        } as any,
        { id: 'u1', email: 'a@b.com', roles: ['professional'] },
      ),
    ).rejects.toThrow(PreconditionFailedException);

    const saved = await service.createException(
      {
        professionalId: 'p1',
        date: '2099-05-01',
        startTime: '09:00',
        endTime: '12:00',
        forceOverwritePending: true,
      } as any,
      { id: 'u1', email: 'a@b.com', roles: ['professional'] },
    );
    expect(appointmentsService.cancelAppointment).toHaveBeenCalledWith('a1');
    expect(saved).toHaveLength(1);

    await service.getExceptions('p1', undefined, '2099-05-01');
    await service.getExceptions(undefined, 'b1');

    exceptionRepo.findOne.mockResolvedValue(null);
    await expect(
      service.deleteException('ex1', {
        id: 'u1',
        email: 'a@b.com',
        roles: ['professional'],
      }),
    ).rejects.toThrow(NotFoundException);

    exceptionRepo.findOne.mockResolvedValue({
      id: 'ex1',
      professional: { id: 'p1' },
    });
    expect(
      await service.deleteException('ex1', {
        id: 'u1',
        email: 'a@b.com',
        roles: ['professional'],
      }),
    ).toEqual({ success: true });
  });

  it('should compute getAvailableBounds for specific professional and for whole business', async () => {
    operatingHourRepo.findOne.mockResolvedValue({
      isOpen: true,
      startTime: '08:00',
      endTime: '18:00',
    });
    shiftRepo.find.mockResolvedValue([
      {
        startTime: '08:00',
        endTime: '12:00',
        businessProfessional: { professional: { id: 'p1' } },
      },
      {
        startTime: '11:00',
        endTime: '18:00',
        businessProfessional: { professional: { id: 'p1' } },
      },
    ]);
    exceptionRepo.find.mockResolvedValue([
      { startTime: '12:00', endTime: '13:00' },
    ]);
    appointmentsService.getBusySlotsByDate.mockResolvedValue([
      { startTime: '15:00', endTime: '16:00' },
    ]);

    const bounds = await service.getAvailableBounds(
      '2099-08-10',
      'b1',
      's1',
    );
    expect(bounds).toEqual([
      { start: '08:00', end: '12:00', durationAvailable: 240 },
      { start: '13:00', end: '15:00', durationAvailable: 120 },
      { start: '16:00', end: '18:00', durationAvailable: 120 },
    ]);

    // Past date returns empty
    const pastBounds = await service.getAvailableBounds(
      '2000-01-01',
      'b1',
      's1',
      'p1',
    );
    expect(pastBounds).toEqual([]);

    await service.getShiftsByBusinessProfessional('bp1');
    const profIds = await service.getBusinessProfessionalIds('b1');
    expect(profIds).toEqual(['p1']);
  });
});
