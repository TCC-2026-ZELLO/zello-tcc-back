import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';

import {
  AppointmentGroup,
  AppointmentGroupStatus,
} from './entities/appointment-group.entity';
import {
  Appointment,
  ACTIVE_STATUSES,
} from '../appointments/entities/appointment.entity';
import { Manager } from '../profiles/managers/entities/manager.entity';
import { BusinessManager } from '../business-managers/entities/business-manager.entity';
import { CombosService } from './combos.service';
import {
  ComboAssignment,
  ComboAvailabilityService,
  ComboSlot,
} from './combo-availability.service';
import { buildComboPlan } from './combo-plan';
import {
  CreateComboBookingDto,
  RejectComboBookingDto,
} from './dto/combo-booking.dto';
import { minsToTime, timeToMins } from '../../common/Time.util';

const GROUP_RELATIONS = [
  'combo',
  'client',
  'business',
  'appointments',
  'appointments.service',
  'appointments.professional',
  'appointments.professional.user',
];

const BLOCKING_STATUSES = ['CONFIRMED'];

export class ComboBookingsService {
  private readonly logger = new Logger(ComboBookingsService.name);

  constructor(
    @InjectRepository(AppointmentGroup)
    private readonly groupRepo: Repository<AppointmentGroup>,
    @InjectRepository(Manager)
    private readonly managerRepo: Repository<Manager>,
    @InjectRepository(BusinessManager)
    private readonly bmRepo: Repository<BusinessManager>,
    private readonly combosService: CombosService,
    private readonly comboAvailability: ComboAvailabilityService,
    private readonly dataSource: DataSource,
  ) {}

  // ─── Cliente ───────────────────────────────────────────────────────────────

  async request(
    comboId: string,
    clientUserId: string,
    dto: CreateComboBookingDto,
  ): Promise<AppointmentGroup> {
    const combo = await this.combosService.findEntity(comboId);
    if (!combo.active) {
      throw new BadRequestException('Este combo não está mais disponível.');
    }

    const preferred = Object.fromEntries(
      (dto.professionals ?? []).map((p) => [p.serviceId, p.professionalId]),
    );

    return this.dataSource.transaction(async (manager) => {
      const slot = await this.comboAvailability.resolveAssignments({
        comboId,
        date: dto.date,
        startTime: dto.startTime,
        preferred,
      });

      if (!slot) {
        throw new ConflictException(
          'Não há profissionais disponíveis para todos os serviços deste combo no horário escolhido.',
        );
      }

      await this.lockDays(manager, slot.assignments, dto.date);
      await this.assertNoConflicts(manager, slot.assignments, dto.date);

      const plan = buildComboPlan(combo);
      const start = timeToMins(dto.startTime);

      const group = await manager.save(AppointmentGroup, {
        combo: { id: combo.id },
        comboName: combo.name,
        client: { id: clientUserId },
        business: { id: combo.business.id },
        date: dto.date,
        startTime: dto.startTime,
        endTime: minsToTime(start + plan.totalBlock),
        status: 'PENDING' as AppointmentGroupStatus,
        originalPrice: plan.originalPrice,
        finalPrice: plan.finalPrice,
      } as Partial<AppointmentGroup>);

      await manager.save(
        Appointment,
        slot.assignments.map((assignment) => ({
          date: dto.date,
          startTime: assignment.startTime,
          // O endTime do agendamento inclui a limpeza: é ele que a agenda lê.
          endTime: assignment.blockedUntil,
          client: { id: clientUserId },
          professional: { id: assignment.professionalId },
          business: { id: combo.business.id },
          service: { id: assignment.serviceId },
          group: { id: group.id },
          sequence: assignment.sequence,
          status: 'PENDING' as const,
        })),
      );

      return this.findGroup(group.id, manager);
    });
  }

  async cancelByClient(groupId: string, clientUserId: string) {
    const group = await this.findGroup(groupId);

    if (group.client.id !== clientUserId) {
      throw new ForbiddenException('Você não pode cancelar esta solicitação.');
    }
    if (group.status !== 'PENDING') {
      throw new BadRequestException(
        'Solicitações já confirmadas devem ser canceladas pelo estabelecimento.',
      );
    }

    return this.closeGroup(group, {
      reason: null,
      cancelledByRole: 'client',
    });
  }

  async findMyBookings(clientUserId: string) {
    const groups = await this.groupRepo.find({
      where: { client: { id: clientUserId } },
      relations: GROUP_RELATIONS,
      order: { date: 'DESC', startTime: 'DESC' },
    });
    return groups.map((group) => this.toPublic(group));
  }

  // ─── Gestor ────────────────────────────────────────────────────────────────

  async findByBusiness(
    businessId: string,
    userId: string,
    status?: AppointmentGroupStatus,
  ) {
    await this.assertManagerAuthority(userId, businessId);

    const groups = await this.groupRepo.find({
      where: {
        business: { id: businessId },
        ...(status ? { status } : {}),
      },
      relations: GROUP_RELATIONS,
      order: { date: 'ASC', startTime: 'ASC' },
    });

    return groups.map((group) => this.toPublic(group));
  }

  async approve(groupId: string, userId: string) {
    return this.dataSource.transaction(async (manager) => {
      const group = await this.findGroup(groupId, manager);
      await this.assertManagerAuthority(userId, group.business.id);

      if (group.status !== 'PENDING') {
        throw new BadRequestException(
          `Esta solicitação já foi processada (${group.status}).`,
        );
      }

      const assignments = this.assignmentsOf(group);
      await this.lockDays(manager, assignments, group.date);
      await this.assertNoConflicts(manager, assignments, group.date, group.id);

      await manager.update(
        Appointment,
        { group: { id: group.id } },
        { status: 'CONFIRMED', confirmedAt: new Date() },
      );

      group.status = 'CONFIRMED';
      group.confirmedAt = new Date();
      await manager.save(AppointmentGroup, group);
      return this.toPublic(await this.findGroup(group.id, manager));
    });
  }

  async reject(groupId: string, userId: string, dto: RejectComboBookingDto) {
    const group = await this.findGroup(groupId);
    await this.assertManagerAuthority(userId, group.business.id);

    if (group.status !== 'PENDING') {
      throw new BadRequestException(
        `Esta solicitação já foi processada (${group.status}).`,
      );
    }

    return this.closeGroup(group, {
      reason: dto.reason,
      cancelledByRole: 'manager_justified',
      restartRequired: true,
    });
  }

  async cancelByManager(
    groupId: string,
    userId: string,
    dto: RejectComboBookingDto,
  ) {
    const group = await this.findGroup(groupId);
    await this.assertManagerAuthority(userId, group.business.id);

    if (!['PENDING', 'CONFIRMED'].includes(group.status)) {
      throw new BadRequestException(
        `Não é possível cancelar uma solicitação com status ${group.status}.`,
      );
    }

    return this.closeGroup(group, {
      reason: dto.reason,
      cancelledByRole: 'manager_justified',
      restartRequired: true,
    });
  }

  // ─── Internos ──────────────────────────────────────────────────────────────

  private async closeGroup(
    group: AppointmentGroup,
    opts: {
      reason: string | null;
      cancelledByRole: string;
      restartRequired?: boolean;
    },
  ) {
    await this.dataSource.transaction(async (manager) => {
      await manager.update(
        Appointment,
        { group: { id: group.id }, status: In(ACTIVE_STATUSES) },
        {
          status: 'CANCELLED',
          cancelledByRole: opts.cancelledByRole,
          cancellationReason: opts.reason,
        },
      );

      group.status = 'CANCELLED';
      group.cancellationReason = opts.reason;
      group.cancelledByRole = opts.cancelledByRole;
      await manager.save(AppointmentGroup, group);
    });

    const saved = await this.findGroup(group.id);

    if (opts.restartRequired) {
      this.logger.log(
        `Combo ${saved.id} encerrado (${opts.cancelledByRole}). Cliente ${saved.client?.id} precisa ser avisado.`,
      );
    }

    return this.toPublic(saved);
  }

  private async lockDays(
    manager: EntityManager,
    assignments: ComboAssignment[],
    date: string,
  ) {
    const ids = [...new Set(assignments.map((a) => a.professionalId))].sort();

    for (const professionalId of ids) {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `appointment:${professionalId}:${date}`,
      ]);
    }
  }

  private async assertNoConflicts(
    manager: EntityManager,
    assignments: ComboAssignment[],
    date: string,
    excludeGroupId?: string,
  ) {
    for (const assignment of assignments) {
      const query = manager
        .getRepository(Appointment)
        .createQueryBuilder('a')
        .where('a.professional = :professionalId', {
          professionalId: assignment.professionalId,
        })
        .andWhere('a.date = :date', { date })
        .andWhere('a.status IN (:...statuses)', { statuses: BLOCKING_STATUSES })
        .andWhere('a.startTime < :end AND a.endTime > :start', {
          start: assignment.startTime,
          end: assignment.blockedUntil,
        });

      if (excludeGroupId) {
        query.andWhere('(a.groupId IS NULL OR a.groupId != :groupId)', {
          groupId: excludeGroupId,
        });
      }

      if (await query.getOne()) {
        throw new ConflictException({
          code: 'COMBO_SLOT_TAKEN',
          message: `A agenda de ${assignment.professionalName} foi ocupada às ${assignment.startTime}. Recuse a solicitação ou proponha outro horário.`,
        });
      }
    }
  }

  private assignmentsOf(group: AppointmentGroup): ComboAssignment[] {
    return (group.appointments ?? []).map((appointment) => ({
      sequence: appointment.sequence ?? 0,
      serviceId: appointment.service.id,
      serviceName: appointment.service.name,
      professionalId: appointment.professional.id,
      professionalName: appointment.professional.user?.name ?? 'Profissional',
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      blockedUntil: appointment.endTime,
    }));
  }

  private async findGroup(
    id: string,
    manager?: EntityManager,
  ): Promise<AppointmentGroup> {
    const repo = manager
      ? manager.getRepository(AppointmentGroup)
      : this.groupRepo;

    const group = await repo.findOne({
      where: { id },
      relations: GROUP_RELATIONS,
    });

    if (!group) throw new NotFoundException('Solicitação não encontrada.');
    return group;
  }

  private toPublic(group: AppointmentGroup) {
    return {
      id: group.id,
      comboId: group.combo?.id ?? null,
      comboName: group.comboName,
      status: group.status,
      date: group.date,
      startTime: group.startTime,
      endTime: group.endTime,
      originalPrice: group.originalPrice,
      finalPrice: group.finalPrice,
      discount: Number((group.originalPrice - group.finalPrice).toFixed(2)),
      cancellationReason: group.cancellationReason,
      client: group.client && {
        id: group.client.id,
        name: (group.client as any).name,
      },
      items: [...(group.appointments ?? [])]
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
        .map((appointment) => ({
          appointmentId: appointment.id,
          serviceName: appointment.service?.name,
          professionalName: appointment.professional?.user?.name,
          startTime: appointment.startTime,
          endTime: appointment.endTime,
          status: appointment.status,
        })),
    };
  }

  private toEvent(group: AppointmentGroup) {
    return {
      groupId: group.id,
      clientId: group.client?.id,
      businessId: group.business?.id,
      comboName: group.comboName,
      date: group.date,
      startTime: group.startTime,
    };
  }

  private async assertManagerAuthority(userId: string, businessId: string) {
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
        'Você não tem permissão para acessar as solicitações desta empresa.',
      );
    }
  }
}

export type { ComboSlot };
