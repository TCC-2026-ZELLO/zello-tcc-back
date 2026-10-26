import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';

describe('AppointmentsController', () => {
  let controller: AppointmentsController;
  let service: any;

  beforeEach(async () => {
    service = {
      findByClient: jest.fn().mockResolvedValue([]),
      findAll: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'a1' }),
      cancelClientAppointment: jest.fn().mockResolvedValue(undefined),
      rescheduleByClient: jest.fn().mockResolvedValue({ id: 'a1' }),
      proposeReschedule: jest.fn().mockResolvedValue({ id: 'a1' }),
      respondToProposal: jest.fn().mockResolvedValue({ id: 'a1' }),
      findByBusiness: jest.fn().mockResolvedValue([]),
      updateStatus: jest.fn().mockResolvedValue({ id: 'a1' }),
      markNoShow: jest.fn().mockResolvedValue({ id: 'a1' }),
      revertNoShow: jest.fn().mockResolvedValue({ id: 'a1' }),
      cancelJustified: jest.fn().mockResolvedValue({ id: 'a1' }),
      getClientReputation: jest
        .fn()
        .mockResolvedValue({ noShowCount: 0, successStreak: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppointmentsController],
      providers: [
        {
          provide: AppointmentsService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<AppointmentsController>(AppointmentsController);
  });

  it('should be defined and delegate all endpoints to AppointmentsService', async () => {
    const req = { user: { id: 'u1', email: 'u1@zello.com', roles: ['client'] } };

    expect(await controller.findMy(req)).toEqual([]);
    expect(await controller.findAll(req, '2026-10-10')).toEqual([]);
    expect(await controller.create(req, {} as any)).toEqual({
      message: 'Pedido enviado e aguarda aprovação',
      data: { id: 'a1' },
    });
    expect(await controller.cancel(req, 'a1')).toEqual({
      message: 'Agendamento cancelado com sucesso',
    });
    expect(await controller.reschedule(req, 'a1', {} as any)).toEqual({
      message: 'Agendamento remarcado com sucesso',
      data: { id: 'a1' },
    });
    expect(await controller.proposeReschedule(req, 'a1', {} as any)).toEqual({
      message: 'Proposta enviada ao cliente',
      data: { id: 'a1' },
    });
    expect(
      await controller.respondToProposal(req, 'a1', { accept: true }),
    ).toEqual({
      message: 'Novo horário confirmado',
      data: { id: 'a1' },
    });
    expect(
      await controller.respondToProposal(req, 'a1', { accept: false }),
    ).toEqual({
      message: 'Proposta recusada',
      data: { id: 'a1' },
    });
    expect(await controller.findByBusiness(req, 'b1')).toEqual([]);
    expect(
      await controller.updateStatus(req, 'a1', { status: 'CONFIRMED' }),
    ).toEqual({
      message: 'Status atualizado para CONFIRMED',
      data: { id: 'a1' },
    });
    expect(await controller.markNoShow(req, 'a1')).toEqual({
      message: 'No-Show registrado com sucesso.',
      data: { id: 'a1' },
    });
    expect(await controller.revertNoShow(req, 'a1')).toEqual({
      message: 'No-Show revertido com sucesso.',
      data: { id: 'a1' },
    });
    expect(
      await controller.cancelJustified(req, 'a1', {
        reason: 'Chuva',
        affectsReputation: false,
      }),
    ).toEqual({
      message: 'Cancelamento efetuado com sucesso.',
      data: { id: 'a1' },
    });
    expect(await controller.getClientReputation('c1')).toEqual({
      noShowCount: 0,
      successStreak: 1,
    });
  });
});
