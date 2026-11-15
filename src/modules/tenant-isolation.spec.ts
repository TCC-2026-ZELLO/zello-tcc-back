import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AppointmentsService } from './appointments/appointments.service';
import { AvailabilityService } from './availability/availability.service';
import { ReviewsService } from './reviews/reviews.service';
import { BusinessManagersService } from './business-managers/business-managers.service';
import { CatalogService } from './catalog/catalog.service';
import { TenantAccessService } from '../common/security/tenant-access.service';

/**
 * Testes de isolamento multitenant e de posse de recurso
 * (v5.0.0-8.2.2, 8.3.1, 8.4.1) na camada de serviço.
 */
describe('Isolamento multitenant na camada de serviço', () => {
  const managerA = { id: 'user-a', email: 'a@zello.com', roles: ['manager'] };
  const admin = { id: 'adm', email: 'adm@zello.com', roles: ['admin'] };
  const client = { id: 'user-c', email: 'c@zello.com', roles: ['client'] };
  const professional = {
    id: 'user-p',
    email: 'p@zello.com',
    roles: ['professional'],
  };

  describe('AppointmentsService', () => {
    let service: AppointmentsService;
    let appointmentRepo: any;
    let clientRepo: any;
    let professionalRepo: any;
    let managerRepo: any;
    let bmRepo: any;

    beforeEach(() => {
      appointmentRepo = { find: jest.fn().mockResolvedValue([]) };
      clientRepo = { findOne: jest.fn() };
      professionalRepo = { findOne: jest.fn() };
      managerRepo = { findOne: jest.fn().mockResolvedValue({ id: 'm-a' }) };
      bmRepo = { findOne: jest.fn() };
      service = new AppointmentsService(
        appointmentRepo,
        {} as any,
        {} as any,
        bmRepo,
        managerRepo,
        clientRepo,
        { getRepository: () => professionalRepo } as any,
      );
    });

    it('não existe listagem global de agendamentos', async () => {
      professionalRepo.findOne.mockResolvedValue(null);
      await expect(service.findAll(client.id, {})).rejects.toThrow(
        ForbiddenException,
      );
      await expect(
        service.findAll(client.id, { date: '2026-01-01' }),
      ).rejects.toThrow(ForbiddenException);
      expect(appointmentRepo.find).not.toHaveBeenCalled();
    });

    it('gestor não lista agendamentos de estabelecimento que não gerencia', async () => {
      bmRepo.findOne.mockResolvedValue(null);
      await expect(
        service.findAll(managerA.id, { businessId: 'business-b' }),
      ).rejects.toThrow(ForbiddenException);
      expect(appointmentRepo.find).not.toHaveBeenCalled();
    });

    it('profissional só consulta a própria agenda', async () => {
      professionalRepo.findOne.mockResolvedValue({ id: 'prof-1' });
      await expect(
        service.findAll(professional.id, { professionalId: 'prof-2' }),
      ).rejects.toThrow(ForbiddenException);

      await service.findAll(professional.id, {});
      expect(appointmentRepo.find.mock.calls[0][0].where.professional).toEqual({
        id: 'prof-1',
      });
    });

    it('reputação de cliente: o próprio cliente e a equipe de atendimento', async () => {
      clientRepo.findOne
        .mockResolvedValueOnce({ id: 'client-profile-c' }) // perfil do solicitante
        .mockResolvedValueOnce({ noShowCount: 1, successStreak: 2 });
      expect(
        await service.getClientReputation('client-profile-c', client),
      ).toEqual({ noShowCount: 1, successStreak: 2 });

      clientRepo.findOne.mockReset();
      clientRepo.findOne.mockResolvedValueOnce({ id: 'client-profile-c' });
      await expect(
        service.getClientReputation('outro-cliente', client),
      ).rejects.toThrow(ForbiddenException);

      clientRepo.findOne.mockReset();
      clientRepo.findOne.mockResolvedValue({
        noShowCount: 0,
        successStreak: 0,
      });
      expect(await service.getClientReputation('x', managerA)).toEqual({
        noShowCount: 0,
        successStreak: 0,
      });
    });
  });

  describe('AvailabilityService', () => {
    let service: AvailabilityService;
    let tenantAccess: any;
    let shiftRepo: any;
    let exceptionRepo: any;
    let profRepo: any;
    let managerRepo: any;
    let bmRepo: any;

    beforeEach(() => {
      tenantAccess = {
        isAdmin: jest.fn((r) => r.roles?.includes('admin')),
        managesBusiness: jest.fn().mockResolvedValue(false),
        managesProfessional: jest.fn().mockResolvedValue(false),
        isProfessionalOfLink: jest.fn().mockResolvedValue(false),
      };
      shiftRepo = {
        manager: {
          findOne: jest
            .fn()
            .mockResolvedValue({ id: 'bp1', business: { id: 'business-b' } }),
        },
      };
      exceptionRepo = { findOne: jest.fn(), remove: jest.fn() };
      profRepo = { findOne: jest.fn().mockResolvedValue(null) };
      managerRepo = { findOne: jest.fn().mockResolvedValue({ id: 'm-a' }) };
      bmRepo = { findOne: jest.fn().mockResolvedValue(null) };
      service = new AvailabilityService(
        { findOne: jest.fn() } as any,
        shiftRepo,
        exceptionRepo,
        bmRepo,
        managerRepo,
        profRepo,
        {} as any,
        {} as any,
        {} as any,
        tenantAccess,
      );
    });

    const shiftDto = {
      businessProfessionalId: 'bp1',
      dayOfWeek: 1,
      startTime: '09:00:00',
      endTime: '17:00:00',
    };

    it('gestor de outro estabelecimento não cria turno', async () => {
      await expect(service.createShift(shiftDto, managerA)).rejects.toThrow(
        ForbiddenException,
      );
      expect(tenantAccess.managesBusiness).toHaveBeenCalledWith(
        'user-a',
        'business-b',
      );
    });

    it('bloqueio de agenda exige escopo e vínculo com o profissional', async () => {
      await expect(
        service.createException({ startTime: '09:00' } as any, managerA),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createException(
          { date: '2026-01-01', startTime: '09:00', endTime: '10:00' } as any,
          managerA,
        ),
      ).rejects.toThrow(BadRequestException);

      // Profissional de estabelecimento que o gestor não gerencia.
      await expect(
        service.createException(
          { date: '2026-01-01', professionalId: 'prof-de-outro' } as any,
          managerA,
        ),
      ).rejects.toThrow(ForbiddenException);

      // Estabelecimento que o gestor não gerencia.
      await expect(
        service.createException(
          { date: '2026-01-01', businessId: 'business-b' } as any,
          managerA,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('remoção de bloqueio respeita o tenant', async () => {
      exceptionRepo.findOne.mockResolvedValue({
        id: 'e1',
        professional: { id: 'prof-de-outro' },
        business: null,
      });
      await expect(service.deleteException('e1', managerA)).rejects.toThrow(
        ForbiddenException,
      );

      exceptionRepo.findOne.mockResolvedValue({
        id: 'e2',
        professional: null,
        business: null,
      });
      await expect(service.deleteException('e2', managerA)).rejects.toThrow(
        ForbiddenException,
      );

      exceptionRepo.findOne.mockResolvedValue({
        id: 'e3',
        professional: null,
        business: { id: 'business-b' },
      });
      await expect(service.deleteException('e3', managerA)).rejects.toThrow(
        ForbiddenException,
      );
      expect(exceptionRepo.remove).not.toHaveBeenCalled();

      // Gestor do próprio profissional consegue remover.
      tenantAccess.managesProfessional.mockResolvedValue(true);
      exceptionRepo.findOne.mockResolvedValue({
        id: 'e4',
        professional: { id: 'prof-da-casa' },
        business: null,
      });
      expect(await service.deleteException('e4', managerA)).toEqual({
        success: true,
      });
      // Admin da plataforma também.
      expect(await service.deleteException('e4', admin)).toEqual({
        success: true,
      });
    });
  });

  describe('ReviewsService, BusinessManagersService e CatalogService', () => {
    it('avaliações recebidas só para gestor do estabelecimento ou admin', async () => {
      const reviewRepo = { find: jest.fn().mockResolvedValue([]) };
      const managerRepo = { findOne: jest.fn().mockResolvedValue({ id: 'm' }) };
      const bmRepo = { findOne: jest.fn().mockResolvedValue(null) };
      const service = new ReviewsService(
        reviewRepo as any,
        {} as any,
        {} as any,
        {} as any,
        managerRepo as any,
        bmRepo as any,
        {} as any,
      );
      await expect(
        service.findReceivedByBusiness('business-b', managerA),
      ).rejects.toThrow(ForbiddenException);
      expect(reviewRepo.find).not.toHaveBeenCalled();

      await service.findReceivedByBusiness('business-b', admin);
      bmRepo.findOne.mockResolvedValue({ id: 'bm' });
      await service.findReceivedByBusiness('business-a', managerA);
      expect(reviewRepo.find).toHaveBeenCalledTimes(2);
    });

    it('vínculos de gestão e serviços do catálogo de outro tenant são negados', async () => {
      const bmRepo = {
        findOne: jest
          .fn()
          .mockImplementation(async ({ where }) =>
            where.id ? { id: 'link', business: { id: 'business-b' } } : null,
          ),
        find: jest.fn().mockResolvedValue([]),
      };
      const bpRepo = { findOne: jest.fn(), find: jest.fn() };
      const tenantAccess = new TenantAccessService(
        bmRepo as any,
        bpRepo as any,
      );

      const managers = new BusinessManagersService(
        bmRepo as any,
        {} as any,
        tenantAccess,
      );
      await expect(managers.findOneFor('link', managerA)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(
        managers.findByBusinessFor('business-b', managerA),
      ).rejects.toThrow(ForbiddenException);
      expect(await managers.findByBusinessFor('business-b', admin)).toEqual([]);
      expect(await managers.findOneFor('link', admin)).toMatchObject({
        id: 'link',
      });

      const serviceRepo = {
        findOne: jest
          .fn()
          .mockResolvedValue({ id: 's1', business: { id: 'business-b' } }),
        merge: jest.fn(),
        save: jest.fn(),
      };
      const catalog = new CatalogService(
        serviceRepo as any,
        bmRepo as any,
        { findOne: jest.fn().mockResolvedValue(null) } as any,
        {} as any,
        {} as any,
        tenantAccess,
      );
      await expect(
        catalog.update('s1', { price: 1 } as any, managerA),
      ).rejects.toThrow(ForbiddenException);
      await expect(catalog.remove('s1', managerA)).rejects.toThrow(
        ForbiddenException,
      );
      // Usuário sem perfil de gestor não cria serviço.
      await expect(
        catalog.create({ name: 'x' } as any, client.id, 'business-b'),
      ).rejects.toThrow(ForbiddenException);
      expect(serviceRepo.save).not.toHaveBeenCalled();
    });
  });
});

describe('Fluxo sequencial de agendamento (v5.0.0-2.3.1)', () => {
  const build = (current: string) => {
    const appointmentRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'a1',
        status: current,
        business: { id: 'b1' },
        client: { id: 'u1' },
      }),
      save: jest.fn().mockImplementation(async (a) => a),
    };
    const service = new AppointmentsService(
      appointmentRepo as any,
      {} as any,
      {} as any,
      { findOne: jest.fn().mockResolvedValue({ id: 'bm' }) } as any,
      { findOne: jest.fn().mockResolvedValue({ id: 'm' }) } as any,
      {
        findOne: jest.fn().mockResolvedValue(null),
        save: jest.fn(),
      } as any,
      {} as any,
    );
    return { service, appointmentRepo };
  };

  it('aceita apenas PENDING -> CONFIRMED -> COMPLETED', async () => {
    expect(
      (await build('PENDING').service.updateStatus('a1', 'CONFIRMED', 'u'))
        .status,
    ).toBe('CONFIRMED');
    expect(
      (await build('CONFIRMED').service.updateStatus('a1', 'COMPLETED', 'u'))
        .status,
    ).toBe('COMPLETED');
  });

  it('recusa pular etapas ou reabrir agendamentos encerrados', async () => {
    for (const [from, to] of [
      ['PENDING', 'COMPLETED'],
      ['CANCELLED', 'CONFIRMED'],
      ['COMPLETED', 'CONFIRMED'],
      ['NO_SHOW', 'COMPLETED'],
    ]) {
      const { service, appointmentRepo } = build(from);
      await expect(service.updateStatus('a1', to as any, 'u')).rejects.toThrow(
        'Transição de status não permitida',
      );
      expect(appointmentRepo.save).not.toHaveBeenCalled();
    }
  });
});
