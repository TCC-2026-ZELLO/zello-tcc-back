import {
  Injectable,
  ConflictException,
  Inject,
  forwardRef,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  In,
  Not,
  FindOptionsWhere,
  DataSource,
  EntityManager,
} from 'typeorm';

import {
  Appointment,
  AppointmentStatus,
  ACTIVE_STATUSES,
  MAX_RESCHEDULES,
} from './entities/appointment.entity';
import {
  AppointmentReschedule,
  RescheduleInitiator,
} from './entities/appointment-reschedule.entity';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';

import { CatalogService } from '../catalog/catalog.service';
import { AvailabilityService } from '../availability/availability.service';
import { BusinessManager } from '../business-managers/entities/business-manager.entity';
import { Manager } from '../profiles/managers/entities/manager.entity';
import { User } from '../users/entities/user.entity';

export interface AppointmentSlot {
  date: string;
  startTime: string;
  endTime: string;
}

const RESCHEDULE_RELATIONS = [
  'client',
  'professional',
  'professional.user',
  'business',
  'service',
];

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,

    @Inject(forwardRef(() => AvailabilityService))
    private readonly availabilityService: AvailabilityService,

    private readonly catalogService: CatalogService,

    @InjectRepository(BusinessManager)
    private readonly bmRepo: Repository<BusinessManager>,

    @InjectRepository(Manager)
    private readonly managerRepo: Repository<Manager>,

    private readonly dataSource: DataSource,
  ) {}

  async create(
    dto: CreateAppointmentDto,
    clientId: string,
  ): Promise<Appointment> {
    const { totalTime } = await this.catalogService.getServiceDuration(
      dto.serviceId,
    );

    let targetProfessionalId = dto.professionalId;

    if (!targetProfessionalId) {
      const shifts = await this.availabilityService['shiftRepo'].find({
        where: {
          businessProfessional: { business: { id: dto.businessId } },
        },
        relations: [
          'businessProfessional',
          'businessProfessional.professional',
        ],
      });
      const profIds = [
        ...new Set(shifts.map((s) => s.businessProfessional.professional.id)),
      ];

      for (const pId of profIds) {
        const isFree = await this.isWithinAvailableBounds({
          date: dto.date,
          businessId: dto.businessId,
          serviceId: dto.serviceId,
          professionalId: pId,
          startTime: dto.startTime,
          durationMinutes: totalTime,
        });

        if (isFree) {
          targetProfessionalId = pId;
          break;
        }
      }

      if (!targetProfessionalId) {
        throw new ConflictException(
          'Nenhum profissional está disponível neste horário.',
        );
      }
    }

    const isValid = await this.isWithinAvailableBounds({
      date: dto.date,
      businessId: dto.businessId,
      serviceId: dto.serviceId,
      professionalId: targetProfessionalId,
      startTime: dto.startTime,
      durationMinutes: totalTime,
    });

    if (!isValid) {
      throw new ConflictException(
        'O horário selecionado não está mais disponível.',
      );
    }

    const appointment = this.appointmentRepo.create({
      date: dto.date,
      startTime: dto.startTime,
      endTime: this.minsToTime(this.timeToMins(dto.startTime) + totalTime),
      client: { id: clientId },
      professional: { id: targetProfessionalId },
      business: { id: dto.businessId },
      service: { id: dto.serviceId },
      status: 'PENDING',
    });

    return await this.appointmentRepo.save(appointment);
  }

  async rescheduleByClient(
    id: string,
    userId: string,
    dto: RescheduleAppointmentDto,
  ): Promise<Appointment> {
    return this.dataSource.transaction(async (manager) => {
      const appointment = await this.loadForReschedule(manager, id);

      if (appointment.client.id !== userId) {
        throw new ForbiddenException(
          'Você não pode reagendar este atendimento.',
        );
      }

      this.assertReschedulable(appointment);
      this.assertLimitNotReached(appointment);

      return this.applyReschedule(manager, appointment, dto, 'CLIENT', userId);
    });
  }

  async proposeReschedule(
    id: string,
    managerUserId: string,
    dto: RescheduleAppointmentDto,
  ): Promise<Appointment> {
    return this.dataSource.transaction(async (manager) => {
      const appointment = await this.loadForReschedule(manager, id);

      await this.validateManagerAuthority(
        managerUserId,
        appointment.business.id,
      );

      this.assertReschedulable(appointment);
      this.assertLimitNotReached(appointment);

      const proposed = await this.resolveSlot(appointment, dto);

      if (this.isSameSlot(appointment, proposed)) {
        throw new BadRequestException('O horário proposto é igual ao atual.');
      }

      await this.assertSlotIsAvailable(manager, appointment, proposed);

      appointment.proposedDate = proposed.date;
      appointment.proposedStartTime = proposed.startTime;
      appointment.proposedEndTime = proposed.endTime;
      appointment.proposedBy = { id: managerUserId } as User;
      appointment.proposedAt = new Date();

      return manager.save(Appointment, appointment);
    });
  }

  async respondToProposal(
    id: string,
    userId: string,
    accept: boolean,
  ): Promise<Appointment> {
    return this.dataSource.transaction(async (manager) => {
      const appointment = await this.loadForReschedule(manager, id);

      if (appointment.client.id !== userId) {
        throw new ForbiddenException(
          'Você não pode responder a esta proposta.',
        );
      }

      if (!appointment.proposedDate || !appointment.proposedStartTime) {
        throw new BadRequestException(
          'Não há proposta de reagendamento pendente.',
        );
      }

      const proposed: AppointmentSlot = {
        date: appointment.proposedDate,
        startTime: appointment.proposedStartTime,
        endTime: appointment.proposedEndTime as string,
      };

      if (!accept) {
        return this.clearProposal(manager, appointment);
      }

      this.assertReschedulable(appointment);
      this.assertLimitNotReached(appointment);

      return this.applyReschedule(
        manager,
        appointment,
        { date: proposed.date, startTime: proposed.startTime },
        'MANAGER',
        userId,
      );
    });
  }

  private async applyReschedule(
    manager: EntityManager,
    appointment: Appointment,
    dto: RescheduleAppointmentDto,
    initiatedBy: RescheduleInitiator,
    actorId: string,
  ): Promise<Appointment> {
    const target = await this.resolveSlot(appointment, dto);

    if (this.isSameSlot(appointment, target)) {
      throw new BadRequestException('O novo horário é igual ao atual.');
    }

    await this.assertSlotIsAvailable(manager, appointment, target);

    const previous: AppointmentSlot = {
      date: appointment.date,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
    };

    await manager.save(AppointmentReschedule, {
      appointment: { id: appointment.id },
      fromDate: previous.date,
      fromStartTime: previous.startTime,
      fromEndTime: previous.endTime,
      toDate: target.date,
      toStartTime: target.startTime,
      toEndTime: target.endTime,
      initiatedBy,
      actor: { id: actorId },
    });

    appointment.date = target.date;
    appointment.startTime = target.startTime;
    appointment.endTime = target.endTime;
    appointment.rescheduleCount += 1;
    this.resetProposal(appointment);

    return manager.save(Appointment, appointment);
  }

  private async assertSlotIsAvailable(
    manager: EntityManager,
    appointment: Appointment,
    target: AppointmentSlot,
  ): Promise<void> {
    await this.lockProfessionalDay(
      manager,
      appointment.professional.id,
      target.date,
    );

    const withinBounds = await this.isWithinAvailableBounds({
      date: target.date,
      businessId: appointment.business.id,
      serviceId: appointment.service.id,
      professionalId: appointment.professional.id,
      startTime: target.startTime,
      durationMinutes:
        this.timeToMins(target.endTime) - this.timeToMins(target.startTime),
      excludeAppointmentId: appointment.id,
    });

    if (!withinBounds) {
      throw new ConflictException(
        'O profissional não está disponível no horário selecionado.',
      );
    }

    await this.assertNoOverlap(manager, appointment, target);
  }

  private async assertNoOverlap(
    manager: EntityManager,
    appointment: Appointment,
    target: AppointmentSlot,
  ): Promise<void> {
    const conflict = await manager
      .getRepository(Appointment)
      .createQueryBuilder('a')
      .where('a.professional = :professionalId', {
        professionalId: appointment.professional.id,
      })
      .andWhere('a.date = :date', { date: target.date })
      .andWhere('a.id != :id', { id: appointment.id })
      .andWhere('a.status IN (:...statuses)', { statuses: ACTIVE_STATUSES })
      .andWhere('a.startTime < :endTime AND a.endTime > :startTime', {
        startTime: target.startTime,
        endTime: target.endTime,
      })
      .getOne();

    if (conflict) {
      throw new ConflictException(
        'Este horário não está mais disponível. Selecione outro horário.',
      );
    }
  }

  private async lockProfessionalDay(
    manager: EntityManager,
    professionalId: string,
    date: string,
  ): Promise<void> {
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `appointment:${professionalId}:${date}`,
    ]);
  }

  private async resolveSlot(
    appointment: Appointment,
    dto: RescheduleAppointmentDto,
  ): Promise<AppointmentSlot> {
    const { totalTime } = await this.catalogService.getServiceDuration(
      appointment.service.id,
    );

    const startMins = this.timeToMins(dto.startTime);
    const endMins = startMins + totalTime;

    if (endMins > 24 * 60) {
      throw new BadRequestException(
        'O horário selecionado ultrapassa o fim do dia.',
      );
    }

    return {
      date: dto.date,
      startTime: dto.startTime,
      endTime: this.minsToTime(endMins),
    };
  }

  private isSameSlot(appointment: Appointment, slot: AppointmentSlot): boolean {
    return (
      appointment.date === slot.date && appointment.startTime === slot.startTime
    );
  }

  private assertLimitNotReached(appointment: Appointment): void {
    if (appointment.rescheduleCount >= MAX_RESCHEDULES) {
      throw new UnprocessableEntityException({
        code: 'RESCHEDULE_LIMIT_REACHED',
        message: `Limite de ${MAX_RESCHEDULES} reagendamentos atingido para este atendimento.`,
      });
    }
  }

  private assertReschedulable(appointment: Appointment): void {
    if (!ACTIVE_STATUSES.includes(appointment.status)) {
      throw new BadRequestException(
        `Não é possível reagendar um atendimento com status ${appointment.status}.`,
      );
    }

    const start = new Date(`${appointment.date}T${appointment.startTime}:00`);
    if (start.getTime() <= Date.now()) {
      throw new BadRequestException('Este atendimento já ocorreu.');
    }
  }

  private resetProposal(appointment: Appointment): void {
    appointment.proposedDate = null;
    appointment.proposedStartTime = null;
    appointment.proposedEndTime = null;
    appointment.proposedBy = null;
    appointment.proposedAt = null;
  }

  private async clearProposal(
    manager: EntityManager,
    appointment: Appointment,
  ): Promise<Appointment> {
    this.resetProposal(appointment);
    return manager.save(Appointment, appointment);
  }

  private async loadForReschedule(
    manager: EntityManager,
    id: string,
  ): Promise<Appointment> {
    const appointment = await manager.getRepository(Appointment).findOne({
      where: { id },
      relations: RESCHEDULE_RELATIONS,
    });

    if (!appointment) {
      throw new NotFoundException('Agendamento não encontrado.');
    }

    return appointment;
  }


  private async isWithinAvailableBounds(params: {
    date: string;
    businessId: string;
    serviceId: string;
    professionalId: string;
    startTime: string;
    durationMinutes: number;
    excludeAppointmentId?: string;
  }): Promise<boolean> {
    const bounds = await this.availabilityService.getAvailableBounds(
      params.date,
      params.businessId,
      params.serviceId,
      params.professionalId,
    );

    const startMins = this.timeToMins(params.startTime);
    const endMins = startMins + params.durationMinutes;

    return bounds.some(
      (bound) =>
        startMins >= this.timeToMins(bound.start) &&
        endMins <= this.timeToMins(bound.end),
    );
  }

  async getBusySlotsByDate(
    professionalId: string | null,
    date: string,
    statuses: AppointmentStatus[] = ['CONFIRMED'],
    businessId?: string,
    excludeAppointmentId?: string,
  ): Promise<Appointment[]> {
    const where: FindOptionsWhere<Appointment> = {
      date: date,
      status: In(statuses),
    };
    if (professionalId) where.professional = { id: professionalId };
    if (businessId) where.business = { id: businessId };
    if (excludeAppointmentId) where.id = Not(excludeAppointmentId);

    return await this.appointmentRepo.find({
      where,
      select: ['id', 'startTime', 'endTime', 'status'],
    });
  }

  async cancelAppointment(id: string): Promise<void> {
    await this.appointmentRepo.update(id, { status: 'CANCELLED' });
  }

  async cancelClientAppointment(id: string, clientId: string): Promise<void> {
    const appointment = await this.appointmentRepo.findOne({
      where: { id },
      relations: ['client'],
    });

    if (!appointment) {
      throw new NotFoundException('Agendamento não encontrado.');
    }
    if (appointment.client.id !== clientId) {
      throw new ForbiddenException(
        'Você não tem permissão para cancelar este agendamento.',
      );
    }
    if (appointment.status !== 'PENDING') {
      throw new ForbiddenException(
        'Apenas agendamentos pendentes podem ser cancelados diretamente.',
      );
    }

    await this.appointmentRepo.update(id, { status: 'CANCELLED' });
  }

  async findByClient(clientId: string): Promise<Appointment[]> {
    return await this.appointmentRepo.find({
      where: { client: { id: clientId } },
      relations: ['professional', 'professional.user', 'business', 'service'],
      order: { date: 'DESC', startTime: 'DESC' },
    });
  }

  private async validateManagerAuthority(userId: string, businessId: string) {
    const manager = await this.managerRepo.findOne({
      where: { user: { id: userId } },
    });
    if (!manager) {
      throw new ForbiddenException('Perfil de gestor não encontrado.');
    }

    const link = await this.bmRepo.findOne({
      where: { manager: { id: manager.id }, business: { id: businessId } },
    });

    if (!link) {
      throw new ForbiddenException(
        'Você não tem permissão para acessar agendamentos desta empresa.',
      );
    }
  }

  async findByBusiness(
    businessId: string,
    userId: string,
  ): Promise<Appointment[]> {
    await this.validateManagerAuthority(userId, businessId);

    return await this.appointmentRepo.find({
      where: { business: { id: businessId } },
      relations: ['client', 'professional', 'professional.user', 'service'],
      order: { date: 'DESC', startTime: 'ASC' },
    });
  }

  async findAll(
    userId: string,
    params: { date?: string; businessId?: string; professionalId?: string },
  ): Promise<Appointment[]> {
    const where: FindOptionsWhere<Appointment> = {};

    if (params.businessId) {
      await this.validateManagerAuthority(userId, params.businessId);
      where.business = { id: params.businessId };
    }

    if (params.date) where.date = params.date;
    if (params.professionalId) {
      where.professional = { id: params.professionalId };
    }

    return await this.appointmentRepo.find({
      where,
      relations: ['client', 'professional', 'professional.user', 'service'],
      order: { startTime: 'ASC' },
    });
  }

  async updateStatus(
    id: string,
    status: AppointmentStatus,
    userId: string,
  ): Promise<Appointment> {
    const appointment = await this.appointmentRepo.findOne({
      where: { id },
      relations: ['business'],
    });

    if (!appointment) {
      throw new NotFoundException('Agendamento não encontrado.');
    }

    await this.validateManagerAuthority(userId, appointment.business.id);

    appointment.status = status;
    return await this.appointmentRepo.save(appointment);
  }

  private timeToMins(time: string): number {
    const [hours, mins] = time.split(':').map(Number);
    return hours * 60 + mins;
  }

  private minsToTime(mins: number): string {
    const h = Math.floor(mins / 60)
      .toString()
      .padStart(2, '0');
    const m = (mins % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  }
}
