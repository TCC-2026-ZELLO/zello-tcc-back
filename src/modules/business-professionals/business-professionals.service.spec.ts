import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { BusinessProfessionalsService } from './business-professionals.service';

describe('BusinessProfessionalsService', () => {
  let service: BusinessProfessionalsService;
  let bpRepo: any;
  let bpsRepo: any;
  let bmRepo: any;
  let professionalRepo: any;
  let managerRepo: any;
  let shiftRepo: any;
  let txEm: any;

  beforeEach(() => {
    txEm = {
      find: jest.fn().mockResolvedValue([
        { dayOfWeek: 1, isOpen: true, startTime: '08:00', endTime: '18:00' },
        { dayOfWeek: 2, isOpen: false, startTime: '08:00', endTime: '18:00' },
      ]),
      delete: jest.fn().mockResolvedValue(undefined),
      create: jest.fn().mockImplementation((_cls, d) => d),
      save: jest.fn().mockImplementation(async (_cls, d) => d),
    };

    bpRepo = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation((d) => ({ id: 'bp1', ...d })),
      save: jest.fn().mockImplementation(async (d) => d),
      merge: jest.fn(),
      remove: jest.fn().mockResolvedValue(undefined),
      manager: {
        transaction: jest.fn().mockImplementation((cb) => cb(txEm)),
      },
    };
    bpsRepo = {
      find: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue(undefined),
      create: jest.fn().mockImplementation((d) => d),
      save: jest.fn().mockImplementation(async (d) => d),
    };
    bmRepo = { findOne: jest.fn() };
    professionalRepo = { findOne: jest.fn() };
    managerRepo = { findOne: jest.fn() };
    shiftRepo = { find: jest.fn().mockResolvedValue([]) };

    service = new BusinessProfessionalsService(
      bpRepo,
      bpsRepo,
      bmRepo,
      professionalRepo,
      managerRepo,
      shiftRepo,
    );
  });

  it('should create business-professional link and validate permissions', async () => {
    managerRepo.findOne.mockResolvedValue(null);
    await expect(
      service.create({ email: 'p@zello.com', businessId: 'b1' }, 'u1'),
    ).rejects.toThrow(ForbiddenException);

    managerRepo.findOne.mockResolvedValue({ id: 'm1' });
    bmRepo.findOne.mockResolvedValue(null);
    await expect(
      service.create({ email: 'p@zello.com', businessId: 'b1' }, 'u1'),
    ).rejects.toThrow(ForbiddenException);

    bmRepo.findOne.mockResolvedValue({ id: 'bm1' });
    professionalRepo.findOne.mockResolvedValue(null);
    await expect(
      service.create({ email: 'p@zello.com', businessId: 'b1' }, 'u1'),
    ).rejects.toThrow(NotFoundException);

    professionalRepo.findOne.mockResolvedValue({ id: 'p1' });
    bpRepo.findOne.mockResolvedValue({ id: 'existing' });
    await expect(
      service.create({ email: 'p@zello.com', businessId: 'b1' }, 'u1'),
    ).rejects.toThrow(ConflictException);

    bpRepo.findOne.mockResolvedValue(null);
    const created = await service.create(
      { email: 'p@zello.com', businessId: 'b1' },
      'u1',
    );
    expect(created.id).toBe('bp1');
  });

  it('should find, update, remove, and manage services and shifts', async () => {
    bpRepo.findOne.mockResolvedValue({
      id: 'bp1',
      business: { id: 'b1' },
    });

    await service.findAllByBusiness('b1');
    await service.findAll();
    await service.findOne('bp1');
    await service.update('bp1', { active: false });
    await service.remove('bp1');
    await service.findProfessionalServices('bp1');
    const savedServices = await service.updateProfessionalServices('bp1', [
      's1',
      's2',
    ]);
    expect(savedServices).toHaveLength(2);

    await service.findProfessionalShifts('bp1');
    const savedShifts = await service.updateProfessionalShifts('bp1', [
      { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 2, startTime: '09:00', endTime: '17:00' },
    ]);
    expect(savedShifts).toHaveLength(1);

    bpRepo.findOne.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    await expect(
      service.updateProfessionalShifts('missing', []),
    ).rejects.toThrow('Vínculo não encontrado.');
  });
});
