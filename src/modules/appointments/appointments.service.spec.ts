import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentsService } from './appointments.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Appointment } from './entities/appointment.entity';
import { AvailabilityService } from '../availability/availability.service';
import { CatalogService } from '../catalog/catalog.service';
import { BusinessManager } from '../business-managers/entities/business-manager.entity';
import { Manager } from '../profiles/managers/entities/manager.entity';
import { Client } from '../profiles/clients/entities/client.entity';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('AppointmentsService RF21 Tests', () => {
  let service: AppointmentsService;
  
  const mockAppointmentRepo = {
    findOne: jest.fn(),
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

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        { provide: getRepositoryToken(Appointment), useValue: mockAppointmentRepo },
        { provide: AvailabilityService, useValue: {} },
        { provide: CatalogService, useValue: {} },
        { provide: getRepositoryToken(BusinessManager), useValue: mockBmRepo },
        { provide: getRepositoryToken(Manager), useValue: mockManagerRepo },
        { provide: getRepositoryToken(Client), useValue: mockClientRepo },
      ],
    }).compile();

    service = module.get<AppointmentsService>(AppointmentsService);
  });

  describe('markNoShow', () => {
    it('should throw if before service time', async () => {
      mockManagerRepo.findOne.mockResolvedValue({});
      mockBmRepo.findOne.mockResolvedValue({});
      mockAppointmentRepo.findOne.mockResolvedValue({
        id: '1',
        status: 'CONFIRMED',
        date: '2099-01-01', // Future date
        startTime: '10:00',
        business: { id: 'b1' },
      });

      await expect(service.markNoShow('1', 'm1')).rejects.toThrow(ForbiddenException);
    });

    it('should mark NO_SHOW and apply penalty', async () => {
      mockManagerRepo.findOne.mockResolvedValue({});
      mockBmRepo.findOne.mockResolvedValue({});
      
      const appDate = new Date();
      appDate.setHours(appDate.getHours() - 2); // Past date
      
      const appointment = {
        id: '1',
        status: 'CONFIRMED',
        date: appDate.toISOString().split('T')[0],
        startTime: '00:00',
        business: { id: 'b1' },
        client: { id: 'u1' }
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
        business: { id: 'b1' },
        client: { id: 'u1' }
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
        client: { id: 'u1' }
      };
      const clientProfile = { id: 'c1', noShowCount: 0, successStreak: 3 };

      mockAppointmentRepo.findOne.mockResolvedValue(appointment);
      mockClientRepo.findOne.mockResolvedValue(clientProfile);
      mockAppointmentRepo.save.mockImplementation(async (a) => a);

      const result = await service.cancelJustified('1', 'm1', 'Emergência', true);

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
        client: { id: 'u1' }
      };
      
      mockAppointmentRepo.findOne.mockResolvedValue(appointment);
      mockAppointmentRepo.save.mockImplementation(async (a) => a);

      const result = await service.cancelJustified('1', 'm1', 'Erro nosso', false);

      expect(result.status).toBe('CANCELLED');
      expect(result.cancelledByRole).toBe('manager_justified');
      expect(mockClientRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('cancelClientAppointment', () => {
    it('should throw if within 2h limit and outside 15m grace period', async () => {
      const appDate = new Date();
      appDate.setHours(appDate.getHours() + 1); // 1h in the future (less than 2h)

      const confirmedAt = new Date();
      confirmedAt.setMinutes(confirmedAt.getMinutes() - 20); // 20m ago (outside 15m grace)

      const appointment = {
        id: '1',
        status: 'CONFIRMED',
        client: { id: 'u1' },
        date: appDate.toISOString().split('T')[0],
        startTime: appDate.toTimeString().substring(0, 5),
        confirmedAt,
      };

      mockAppointmentRepo.findOne.mockResolvedValue(appointment);

      await expect(service.cancelClientAppointment('1', 'u1')).rejects.toThrow(ForbiddenException);
    });

    it('should allow if within 15m grace period even if less than 2h', async () => {
      const appDate = new Date();
      appDate.setHours(appDate.getHours() + 1); // 1h in the future

      const confirmedAt = new Date(); // Right now (within grace)

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
      expect(mockAppointmentRepo.update).toHaveBeenCalledWith('1', { status: 'CANCELLED', cancelledByRole: 'client' });
    });
  });
});
