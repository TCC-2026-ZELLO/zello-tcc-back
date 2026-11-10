import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { buildComboPlan } from './combo-plan';
import { CombosService } from './combos.service';
import { CombosController } from './combos.controller';
import { ComboAvailabilityService } from './combo-availability.service';
import { ComboBookingsService } from './combo-bookings.service';
import { ComboBookingsController } from './combo-bookings.controller';

describe('Combos Module (Plan, Services & Controllers)', () => {
  const sampleComboEntity = (): any => ({
    id: 'combo-1',
    name: 'Combo Dia de Noiva',
    description: 'Cabelo + Unha',
    price: 80,
    active: true,
    business: { id: 'b1' },
    items: [
      {
        sequence: 0,
        service: {
          id: 's1',
          name: 'Corte',
          durationMinutes: 45,
          cleanupMinutes: 15,
          price: 60,
        },
      },
      {
        sequence: 1,
        service: {
          id: 's2',
          name: 'Manicure',
          durationMinutes: 30,
          cleanupMinutes: 0,
          price: 40,
        },
      },
    ],
  });

  describe('buildComboPlan', () => {
    it('should build sequential stages, durations, blocks and discount', () => {
      const plan = buildComboPlan(sampleComboEntity());
      expect(plan.originalPrice).toBe(100);
      expect(plan.finalPrice).toBe(80);
      expect(plan.discount).toBe(20);
      expect(plan.discountPercent).toBe(20);
      expect(plan.totalDuration).toBe(90); // 0..45 (block 60), 60..90
      expect(plan.totalBlock).toBe(90);
      expect(plan.stages).toHaveLength(2);

      const emptyPlan = buildComboPlan({
        items: [{ sequence: 0, service: { id: 's1', name: 'S' } }],
      } as any);
      expect(emptyPlan.discountPercent).toBe(0);
      expect(buildComboPlan({} as any).stages).toEqual([]);
    });
  });

  describe('CombosService & CombosController', () => {
    let service: CombosService;
    let controller: CombosController;
    let comboRepo: any;
    let itemRepo: any;
    let serviceRepo: any;
    let managerRepo: any;
    let bmRepo: any;

    beforeEach(() => {
      comboRepo = {
        create: jest.fn().mockImplementation((d) => ({ id: 'combo-1', ...d })),
        save: jest.fn().mockImplementation(async (d) => ({ id: 'combo-1', ...d })),
        findOne: jest.fn().mockResolvedValue(sampleComboEntity()),
        find: jest.fn().mockResolvedValue([sampleComboEntity()]),
        softRemove: jest.fn().mockResolvedValue(undefined),
      };
      itemRepo = {
        create: jest.fn().mockImplementation((d) => d),
        delete: jest.fn().mockResolvedValue(undefined),
      };
      serviceRepo = {
        find: jest.fn().mockResolvedValue([
          {
            id: 's1',
            name: 'Corte',
            durationMinutes: 45,
            cleanupMinutes: 15,
            price: 60,
          },
          {
            id: 's2',
            name: 'Manicure',
            durationMinutes: 30,
            cleanupMinutes: 0,
            price: 40,
          },
        ]),
      };
      managerRepo = { findOne: jest.fn().mockResolvedValue({ id: 'm1' }) };
      bmRepo = { findOne: jest.fn().mockResolvedValue({ id: 'bm1' }) };

      service = new CombosService(
        comboRepo,
        itemRepo,
        serviceRepo,
        managerRepo,
        bmRepo,
      );
      controller = new CombosController(service, {
        getSlots: jest.fn().mockResolvedValue([]),
      } as any);
    });

    it('should create, update, find, and remove combos', async () => {
      const created = await service.create('b1', 'u1', {
        name: 'Combo 1',
        price: 80,
        items: [
          { serviceId: 's1', sequence: 0 },
          { serviceId: 's2', sequence: 1 },
        ],
      });
      expect(created.id).toBe('combo-1');
      expect(created.discount).toBe(20);

      const updated = await service.update('combo-1', 'u1', {
        name: 'Combo Atualizado',
        description: 'Desc',
        price: 75,
        active: true,
        items: [
          { serviceId: 's1', sequence: 0 },
          { serviceId: 's2', sequence: 0 },
        ],
      });
      expect(updated.id).toBe('combo-1');

      expect(await service.findAllByBusiness('b1', true)).toHaveLength(1);
      expect(await service.findOne('combo-1')).toBeDefined();
      expect(await service.remove('combo-1', 'u1')).toEqual({
        message: 'Combo removido do catálogo.',
      });
    });

    it('should validate promotional price, distinct services, and manager authority', async () => {
      await expect(
        service.create('b1', 'u1', {
          name: 'Invalid',
          price: 150, // >= 100
          items: [
            { serviceId: 's1', sequence: 0 },
            { serviceId: 's2', sequence: 1 },
          ],
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.create('b1', 'u1', {
          name: 'Dup',
          price: 50,
          items: [
            { serviceId: 's1', sequence: 0 },
            { serviceId: 's1', sequence: 1 },
          ],
        }),
      ).rejects.toThrow(BadRequestException);

      managerRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create('b1', 'u1', {
          name: 'NoMgr',
          price: 50,
          items: [],
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should delegate controller endpoints', async () => {
      const req = { user: { id: 'u1', email: 'a@b.com', roles: ['manager'] } };
      await controller.create(req, 'b1', {
        name: 'Combo',
        price: 80,
        items: [
          { serviceId: 's1', sequence: 0 },
          { serviceId: 's2', sequence: 1 },
        ],
      });
      await controller.findAllByBusiness('b1', 'true');
      await controller.findOne('combo-1');
      await controller.availability('combo-1', {
        date: '2099-05-10',
        granularity: 30,
      });
      await controller.update(req, 'combo-1', { name: 'Novo' });
      await controller.remove(req, 'combo-1');
    });
  });

  describe('ComboAvailabilityService', () => {
    let availabilityService: any;
    let bpRepo: any;
    let combosService: any;
    let service: ComboAvailabilityService;

    beforeEach(() => {
      availabilityService = {
        getAvailableBounds: jest
          .fn()
          .mockResolvedValue([{ start: '09:00', end: '12:00' }]),
      };
      bpRepo = {
        find: jest.fn().mockResolvedValue([
          {
            professional: { id: 'p1', user: { name: 'Pro 1' } },
            services: [{ service: { id: 's1' } }, { service: { id: 's2' } }],
          },
        ]),
      };
      combosService = {
        findEntity: jest.fn().mockResolvedValue(sampleComboEntity()),
      };
      service = new ComboAvailabilityService(
        availabilityService,
        bpRepo,
        combosService,
      );
    });

    it('should getSlots, resolveAssignments, and getPlan', async () => {
      const slots = await service.getSlots({
        comboId: 'combo-1',
        date: '2099-05-10',
        granularity: 30,
      });
      expect(slots.length).toBeGreaterThan(0);
      expect(slots[0].assignments).toHaveLength(2);

      const resolved = await service.resolveAssignments({
        comboId: 'combo-1',
        date: '2099-05-10',
        startTime: '09:00',
        preferred: { s1: 'p1' },
      });
      expect(resolved).not.toBeNull();

      const plan = await service.getPlan('combo-1');
      expect(plan.totalDuration).toBe(90);
    });

    it('should return empty or null if combo is inactive or preferred professional is invalid', async () => {
      const nullSlot = await service.resolveAssignments({
        comboId: 'combo-1',
        date: '2099-05-10',
        startTime: '09:00',
        preferred: { s1: 'non-existent' },
      });
      expect(nullSlot).toBeNull();

      combosService.findEntity.mockResolvedValue({
        ...sampleComboEntity(),
        active: false,
      });
      expect(
        await service.getSlots({ comboId: 'combo-1', date: '2099-05-10' }),
      ).toEqual([]);
    });
  });

  describe('ComboBookingsService & ComboBookingsController', () => {
    let service: ComboBookingsService;
    let controller: ComboBookingsController;
    let groupRepo: any;
    let managerRepo: any;
    let bmRepo: any;
    let combosService: any;
    let comboAvailability: any;
    let dataSource: any;
    let txManager: any;
    let qbMock: any;

    const sampleGroup = (): any => ({
      id: 'g1',
      combo: { id: 'combo-1' },
      comboName: 'Combo Dia de Noiva',
      status: 'PENDING',
      date: '2099-05-10',
      startTime: '09:00',
      endTime: '10:30',
      originalPrice: 100,
      finalPrice: 80,
      cancellationReason: null,
      client: { id: 'u1', name: 'Cliente 1' },
      business: { id: 'b1' },
      appointments: [
        {
          id: 'a1',
          sequence: 0,
          startTime: '09:00',
          endTime: '10:00',
          status: 'PENDING',
          service: { id: 's1', name: 'Corte' },
          professional: { id: 'p1', user: { name: 'Pro 1' } },
        },
      ],
    });

    beforeEach(() => {
      qbMock = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };

      groupRepo = {
        findOne: jest.fn().mockResolvedValue(sampleGroup()),
        find: jest.fn().mockResolvedValue([sampleGroup()]),
        createQueryBuilder: jest.fn().mockReturnValue(qbMock),
      };

      txManager = {
        query: jest.fn().mockResolvedValue(undefined),
        save: jest.fn().mockImplementation(async (_cls, data) => ({
          id: 'g1',
          ...data,
        })),
        update: jest.fn().mockResolvedValue(undefined),
        getRepository: jest.fn().mockReturnValue(groupRepo),
      };

      managerRepo = { findOne: jest.fn().mockResolvedValue({ id: 'm1' }) };
      bmRepo = { findOne: jest.fn().mockResolvedValue({ id: 'bm1' }) };
      combosService = {
        findEntity: jest.fn().mockResolvedValue(sampleComboEntity()),
      };
      comboAvailability = {
        resolveAssignments: jest.fn().mockResolvedValue({
          startTime: '09:00',
          endTime: '10:30',
          assignments: [
            {
              sequence: 0,
              serviceId: 's1',
              serviceName: 'Corte',
              professionalId: 'p1',
              professionalName: 'Pro 1',
              startTime: '09:00',
              endTime: '09:45',
              blockedUntil: '10:00',
            },
          ],
        }),
      };
      dataSource = {
        transaction: jest.fn().mockImplementation((cb) => cb(txManager)),
      };

      service = new ComboBookingsService(
        groupRepo,
        managerRepo,
        bmRepo,
        combosService,
        comboAvailability,
        dataSource,
      );
      controller = new ComboBookingsController(service);
    });

    it('should request, approve, reject, cancelByManager, cancelByClient, and list bookings', async () => {
      const requested = await service.request('combo-1', 'u1', {
        date: '2099-05-10',
        startTime: '09:00',
      });
      expect(requested.id).toBe('g1');

      const my = await service.findMyBookings('u1');
      expect(my).toHaveLength(1);

      const byBiz = await service.findByBusiness('b1', 'm-user', 'PENDING');
      expect(byBiz).toHaveLength(1);

      const approved = await service.approve('g1', 'm-user');
      expect(approved.id).toBe('g1');

      groupRepo.findOne.mockResolvedValue(sampleGroup());
      const rejected = await service.reject('g1', 'm-user', {
        reason: 'Sem vaga',
      });
      expect(rejected.id).toBe('g1');

      groupRepo.findOne.mockResolvedValue({
        ...sampleGroup(),
        status: 'CONFIRMED',
      });
      const cancelledMgr = await service.cancelByManager('g1', 'm-user', {
        reason: 'Imprevisto',
      });
      expect(cancelledMgr.id).toBe('g1');

      groupRepo.findOne.mockResolvedValue(sampleGroup());
      const cancelledCli = await service.cancelByClient('g1', 'u1');
      expect(cancelledCli.id).toBe('g1');
    });

    it('should throw on conflicts or invalid states in ComboBookingsService', async () => {
      comboAvailability.resolveAssignments.mockResolvedValue(null);
      await expect(
        service.request('combo-1', 'u1', {
          date: '2099-05-10',
          startTime: '09:00',
        }),
      ).rejects.toThrow(ConflictException);

      qbMock.getOne.mockResolvedValue({ id: 'conflict-app' });
      await expect(service.approve('g1', 'm-user')).rejects.toThrow(
        ConflictException,
      );

      groupRepo.findOne.mockResolvedValue(null);
      await expect(service.cancelByClient('g1', 'u1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should delegate all ComboBookingsController endpoints', async () => {
      const req = { user: { id: 'u1', email: 'a@b.com', roles: ['client'] } };
      expect(
        (
          await controller.request(req, 'combo-1', {
            date: '2099-05-10',
            startTime: '09:00',
          })
        ).message,
      ).toBeDefined();
      expect(await controller.findMy(req)).toHaveLength(1);
      expect(await controller.findByBusiness(req, 'b1')).toHaveLength(1);

      groupRepo.findOne.mockResolvedValue(sampleGroup());
      expect((await controller.approve(req, 'g1')).message).toBeDefined();

      groupRepo.findOne.mockResolvedValue(sampleGroup());
      expect(
        (await controller.reject(req, 'g1', { reason: 'r' })).message,
      ).toBeDefined();

      groupRepo.findOne.mockResolvedValue({
        ...sampleGroup(),
        status: 'CONFIRMED',
      });
      expect(
        (await controller.cancelByManager(req, 'g1', { reason: 'r' })).message,
      ).toBeDefined();

      groupRepo.findOne.mockResolvedValue(sampleGroup());
      expect((await controller.cancel(req, 'g1')).message).toBeDefined();
    });
  });
});
