import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentsService } from './appointments.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Appointment } from './entities/appointment.entity';
import { AvailabilityService } from '../availability/availability.service';
import { CatalogService } from '../catalog/catalog.service';
import { BusinessManager } from '../business-managers/entities/business-manager.entity';
import { Manager } from '../profiles/managers/entities/manager.entity';
import { Client } from '../profiles/clients/entities/client.entity';
import { DataSource } from 'typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

describe('AppointmentsService', () => {
  let service: AppointmentsService;

  const mockAppointmentRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  const mockClientRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockManagerRepo = {
    findOne: jest.fn(),
  };

  const mockBmRepo = {
    findOne: jest.fn(),
  };

  const mockAvailabilityService = {
    getAvailableBounds: jest.fn(),
    getBusinessProfessionalIds: jest.fn(),
  };

  const mockCatalogService = {
    getServiceDuration: jest.fn().mockResolvedValue({ totalTime: 60 }),
  };

  const txAppointmentQb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(null),
  };

  const txAppointmentRepo = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue(txAppointmentQb),
  };

  const mockEntityManager = {
    query: jest.fn().mockResolvedValue(undefined),
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockImplementation((_cls, data) => data),
    save: jest.fn().mockImplementation(async (_cls, data) => data),
    getRepository: jest.fn().mockReturnValue(txAppointmentRepo),
  };

  const mockDataSource = {
    transaction: jest.fn().mockImplementation((cb) => cb(mockEntityManager)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockCatalogService.getServiceDuration.mockResolvedValue({ totalTime: 60 });
    mockEntityManager.find.mockResolvedValue([]);
    txAppointmentQb.getOne.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        {
          provide: getRepositoryToken(Appointment),
          useValue: mockAppointmentRepo,
        },
        { provide: AvailabilityService, useValue: mockAvailabilityService },
        { provide: CatalogService, useValue: mockCatalogService },
        { provide: getRepositoryToken(BusinessManager), useValue: mockBmRepo },
        { provide: getRepositoryToken(Manager), useValue: mockManagerRepo },
        { provide: getRepositoryToken(Client), useValue: mockClientRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<AppointmentsService>(AppointmentsService);
  });

  describe('create', () => {
    it('should create appointment with specified professional when slot is free', async () => {
      mockAvailabilityService.getAvailableBounds.mockResolvedValue([
        { start: '08:00', end: '18:00' },
      ]);

      const res = await service.create(
        {
          date: '2099-05-10',
          startTime: '10:00',
          businessId: 'b1',
          serviceId: 's1',
          professionalId: 'p1',
        },
        'c1',
      );

      expect(res.endTime).toBe('11:00');
      expect(res.professional).toEqual({ id: 'p1' });
      expect(mockEntityManager.query).toHaveBeenCalled();
    });

    it('should auto-select an available professional when professionalId is omitted', async () => {
      mockAvailabilityService.getBusinessProfessionalIds.mockResolvedValue([
        'p1',
        'p2',
      ]);
      mockAvailabilityService.getAvailableBounds
        .mockResolvedValueOnce([]) // p1 busy
        .mockResolvedValueOnce([{ start: '09:00', end: '12:00' }]); // p2 free

      const res = await service.create(
        {
          date: '2099-05-10',
          startTime: '10:00',
          businessId: 'b1',
          serviceId: 's1',
        },
        'c1',
      );

      expect(res.professional).toEqual({ id: 'p2' });
    });

    it('should throw ConflictException when no professional is free or overlap detected inside tx', async () => {
      mockAvailabilityService.getBusinessProfessionalIds.mockResolvedValue([
        'p1',
      ]);
      mockAvailabilityService.getAvailableBounds.mockResolvedValue([]);

      await expect(
        service.create(
          {
            date: '2099-05-10',
            startTime: '10:00',
            businessId: 'b1',
            serviceId: 's1',
          },
          'c1',
        ),
      ).rejects.toThrow(ConflictException);

      mockAvailabilityService.getAvailableBounds.mockResolvedValue([
        { start: '08:00', end: '18:00' },
      ]);
      mockEntityManager.find.mockResolvedValue([
        { id: 'a1', startTime: '10:30', endTime: '11:30' },
      ]);

      await expect(
        service.create(
          {
            date: '2099-05-10',
            startTime: '10:00',
            businessId: 'b1',
            serviceId: 's1',
            professionalId: 'p1',
          },
          'c1',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('rescheduleByClient, proposeReschedule, respondToProposal', () => {
    const baseFutureAppt = () => ({
      id: 'a1',
      date: '2099-06-01',
      startTime: '10:00',
      endTime: '11:00',
      status: 'CONFIRMED',
      rescheduleCount: 0,
      client: { id: 'u1' },
      professional: { id: 'p1' },
      business: { id: 'b1' },
      service: { id: 's1' },
      proposedDate: '2099-06-02',
      proposedStartTime: '14:00',
      proposedEndTime: '15:00',
    });

    it('should reschedule by client when valid', async () => {
      txAppointmentRepo.findOne.mockResolvedValue(baseFutureAppt());
      mockAvailabilityService.getAvailableBounds.mockResolvedValue([
        { start: '08:00', end: '18:00' },
      ]);

      const res = await service.rescheduleByClient('a1', 'u1', {
        date: '2099-06-02',
        startTime: '14:00',
      });

      expect(res.date).toBe('2099-06-02');
      expect(res.startTime).toBe('14:00');
      expect(res.rescheduleCount).toBe(1);
    });

    it('should validate reschedule rules (wrong client, limit reached, same slot, past, not found)', async () => {
      txAppointmentRepo.findOne.mockResolvedValue(null);
      await expect(
        service.rescheduleByClient('a1', 'u1', {
          date: '2099-06-02',
          startTime: '14:00',
        }),
      ).rejects.toThrow(NotFoundException);

      txAppointmentRepo.findOne.mockResolvedValue(baseFutureAppt());
      await expect(
        service.rescheduleByClient('a1', 'other-user', {
          date: '2099-06-02',
          startTime: '14:00',
        }),
      ).rejects.toThrow(ForbiddenException);

      txAppointmentRepo.findOne.mockResolvedValue({
        ...baseFutureAppt(),
        rescheduleCount: 2,
      });
      await expect(
        service.rescheduleByClient('a1', 'u1', {
          date: '2099-06-02',
          startTime: '14:00',
        }),
      ).rejects.toThrow(UnprocessableEntityException);

      txAppointmentRepo.findOne.mockResolvedValue(baseFutureAppt());
      await expect(
        service.rescheduleByClient('a1', 'u1', {
          date: '2099-06-01',
          startTime: '10:00',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should proposeReschedule by manager and respondToProposal (accept & reject)', async () => {
      txAppointmentRepo.findOne.mockResolvedValue(baseFutureAppt());
      mockManagerRepo.findOne.mockResolvedValue({ id: 'm1' });
      mockBmRepo.findOne.mockResolvedValue({ id: 'bm1' });
      mockAvailabilityService.getAvailableBounds.mockResolvedValue([
        { start: '08:00', end: '18:00' },
      ]);

      const proposed = await service.proposeReschedule('a1', 'm-user', {
        date: '2099-06-03',
        startTime: '15:00',
      });
      expect(proposed.proposedDate).toBe('2099-06-03');

      // Reject proposal
      txAppointmentRepo.findOne.mockResolvedValue(baseFutureAppt());
      const rejected = await service.respondToProposal('a1', 'u1', false);
      expect(rejected.proposedDate).toBeNull();

      // Accept proposal
      txAppointmentRepo.findOne.mockResolvedValue(baseFutureAppt());
      const accepted = await service.respondToProposal('a1', 'u1', true);
      expect(accepted.date).toBe('2099-06-02');
      expect(accepted.startTime).toBe('14:00');
    });
  });

  describe('markNoShow', () => {
    it('should throw if before service time', async () => {
      mockManagerRepo.findOne.mockResolvedValue({});
      mockBmRepo.findOne.mockResolvedValue({});
      mockAppointmentRepo.findOne.mockResolvedValue({
        id: '1',
        status: 'CONFIRMED',
        date: '2099-01-01',
        startTime: '10:00',
        business: { id: 'b1' },
      });

      await expect(service.markNoShow('1', 'm1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should mark NO_SHOW and apply penalty', async () => {
      mockManagerRepo.findOne.mockResolvedValue({});
      mockBmRepo.findOne.mockResolvedValue({});

      const appDate = new Date();
      appDate.setHours(appDate.getHours() - 2);

      const appointment = {
        id: '1',
        status: 'CONFIRMED',
        date: appDate.toISOString().split('T')[0],
        startTime: '00:00',
        business: { id: 'b1' },
        client: { id: 'u1' },
      };

      const clientProfile = { id: 'c1', noShowCount: 0, successStreak: 5 };

      mockAppointmentRepo.findOne.mockResolvedValue(appointment);
      mockClientRepo.findOne.mockResolvedValue(clientProfile);
      mockAppointmentRepo.save.mockImplementation(async (a) => a);
      mockClientRepo.save.mockImplementation(async (c) => c);

      const result = await service.markNoShow('1', 'm1');

      expect(clientProfile.noShowCount).toBe(1);
      expect(clientProfile.successStreak).toBe(0);
      expect(result.status).toBe('NO_SHOW');
      expect(mockClientRepo.save).toHaveBeenCalledWith(clientProfile);
    });
  });

  describe('revertNoShow', () => {
    it('should revert NO_SHOW and remove penalty', async () => {
      mockManagerRepo.findOne.mockResolvedValue({});
      mockBmRepo.findOne.mockResolvedValue({});
      const appointment = {
        id: '1',
        status: 'NO_SHOW',
        cancelledByRole: 'manager_noshow',
        business: { id: 'b1' },
        client: { id: 'u1' },
      };
      const clientProfile = { id: 'c1', noShowCount: 1, successStreak: 0 };

      mockAppointmentRepo.findOne.mockResolvedValue(appointment);
      mockClientRepo.findOne.mockResolvedValue(clientProfile);
      mockAppointmentRepo.save.mockImplementation(async (a) => a);

      const result = await service.revertNoShow('1', 'm1');

      expect(clientProfile.noShowCount).toBe(0);
      expect(result.status).toBe('COMPLETED');
    });
  });

  describe('cancelJustified', () => {
    it('should cancel and penalize if affectsReputation is true', async () => {
      mockManagerRepo.findOne.mockResolvedValue({});
      mockBmRepo.findOne.mockResolvedValue({});
      const appointment = {
        id: '1',
        status: 'CONFIRMED',
        business: { id: 'b1' },
        client: { id: 'u1' },
      };
      const clientProfile = { id: 'c1', noShowCount: 0, successStreak: 3 };

      mockAppointmentRepo.findOne.mockResolvedValue(appointment);
      mockClientRepo.findOne.mockResolvedValue(clientProfile);
      mockAppointmentRepo.save.mockImplementation(async (a) => a);

      const result = await service.cancelJustified(
        '1',
        'm1',
        'Emergência',
        true,
      );

      expect(result.status).toBe('CANCELLED');
      expect(result.cancellationReason).toBe('Emergência');
      expect(result.cancelledByRole).toBe('manager');
      expect(clientProfile.noShowCount).toBe(1);
      expect(clientProfile.successStreak).toBe(0);
    });

    it('should cancel without penalty if affectsReputation is false', async () => {
      mockManagerRepo.findOne.mockResolvedValue({});
      mockBmRepo.findOne.mockResolvedValue({});
      const appointment = {
        id: '1',
        status: 'CONFIRMED',
        business: { id: 'b1' },
        client: { id: 'u1' },
      };

      mockAppointmentRepo.findOne.mockResolvedValue(appointment);
      mockAppointmentRepo.save.mockImplementation(async (a) => a);

      const result = await service.cancelJustified(
        '1',
        'm1',
        'Erro nosso',
        false,
      );

      expect(result.status).toBe('CANCELLED');
      expect(result.cancelledByRole).toBe('manager_justified');
      expect(mockClientRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('cancelClientAppointment & other query methods', () => {
    it('should throw if within 2h limit and outside 15m grace period', async () => {
      const appDate = new Date();
      appDate.setHours(appDate.getHours() + 1);

      const confirmedAt = new Date();
      confirmedAt.setMinutes(confirmedAt.getMinutes() - 20);

      const appointment = {
        id: '1',
        status: 'CONFIRMED',
        client: { id: 'u1' },
        date: appDate.toISOString().split('T')[0],
        startTime: appDate.toTimeString().substring(0, 5),
        confirmedAt,
      };

      mockAppointmentRepo.findOne.mockResolvedValue(appointment);

      await expect(service.cancelClientAppointment('1', 'u1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow if within 15m grace period even if less than 2h', async () => {
      const appDate = new Date();
      appDate.setHours(appDate.getHours() + 1);

      const confirmedAt = new Date();

      const appointment = {
        id: '1',
        status: 'CONFIRMED',
        client: { id: 'u1' },
        date: appDate.toISOString().split('T')[0],
        startTime: appDate.toTimeString().substring(0, 5),
        confirmedAt,
      };

      mockAppointmentRepo.findOne.mockResolvedValue(appointment);
      mockAppointmentRepo.update.mockResolvedValue({});

      await service.cancelClientAppointment('1', 'u1');
      expect(mockAppointmentRepo.update).toHaveBeenCalledWith('1', {
        status: 'CANCELLED',
        cancelledByRole: 'client',
      });
    });

    it('should execute getBusySlotsByDate, cancelAppointment, getClientReputation, findByClient, findByBusiness, findAll, updateStatus', async () => {
      mockAppointmentRepo.find.mockResolvedValue([]);
      await service.getBusySlotsByDate('p1', '2026-10-10', ['CONFIRMED'], 'b1', 'a0');
      await service.cancelAppointment('a1');

      mockClientRepo.findOne.mockResolvedValue({ noShowCount: 2, successStreak: 4 });
      expect(await service.getClientReputation('c1')).toEqual({
        noShowCount: 2,
        successStreak: 4,
      });

      await service.findByClient('u1');

      mockManagerRepo.findOne.mockResolvedValue({ id: 'm1' });
      mockBmRepo.findOne.mockResolvedValue({ id: 'bm1' });
      await service.findByBusiness('b1', 'u1');

      await service.findAll('u1', {
        businessId: 'b1',
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
        professionalId: 'p1',
      });
      await service.findAll('u1', { date: '2026-01-01' });
      await service.findAll('u1', { dateFrom: '2026-01-01' });
      await service.findAll('u1', { dateTo: '2026-01-31' });

      mockAppointmentRepo.findOne.mockResolvedValue({
        id: 'a1',
        status: 'CONFIRMED',
        business: { id: 'b1' },
        client: { id: 'u1' },
      });
      mockAppointmentRepo.save.mockImplementation(async (a) => a);
      const completed = await service.updateStatus('a1', 'COMPLETED', 'u1');
      expect(completed.status).toBe('COMPLETED');
    });
  });
});
