import {
  Injectable,
  ConflictException,
  Inject,
  forwardRef,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  In,
  FindOptionsWhere,
  EntityManager,
  DataSource,
} from 'typeorm';
import { Appointment, AppointmentStatus } from './entities/appointment.entity';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { CatalogService } from '../catalog/catalog.service';
import { AvailabilityService } from '../availability/availability.service';
import { BusinessManager } from '../business-managers/entities/business-manager.entity';
import { Manager } from '../profiles/managers/entities/manager.entity';

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

    const startMins = this.timeToMins(dto.startTime);
    const endMins = startMins + totalTime;

    const targetProfessionalId = await this.resolveTargetProfessional(
      dto,
      startMins,
      endMins,
    );

    // Transação + lock por (profissional, data): garante que, mesmo que duas
    // requisições passem pela validação de disponibilidade quase ao mesmo
    // tempo, apenas a primeira a confirmar consiga reservar o horário — a
    // segunda é bloqueada até a primeira concluir e então recebe ConflictException
    // ao perceber que o slot já não está mais livre (AC2).
    return await this.dataSource.transaction(async (manager) => {
      await this.lockProfessionalSchedule(
        manager,
        targetProfessionalId,
        dto.date,
      );

      await this.assertNoOverlap(
        manager,
        targetProfessionalId,
        dto.date,
        startMins,
        endMins,
      );

      const appointment = manager.create(Appointment, {
        date: dto.date,
        startTime: dto.startTime,
        endTime: this.minsToTime(endMins),
        client: { id: clientId },
        professional: { id: targetProfessionalId },
        business: { id: dto.businessId },
        service: { id: dto.serviceId },
        status: 'PENDING',
      });

      return await manager.save(Appointment, appointment);
    });
  }

  /**
   * Determina o profissional que atenderá o agendamento: usa o informado no
   * DTO (validando disponibilidade) ou, se ausente, procura o primeiro
   * profissional da empresa livre no horário solicitado.
   */
  private async resolveTargetProfessional(
    dto: CreateAppointmentDto,
    startMins: number,
    endMins: number,
  ): Promise<string> {
    if (dto.professionalId) {
      await this.ensureSlotIsAvailable(
        dto.date,
        dto.businessId,
        dto.serviceId,
        dto.professionalId,
        startMins,
        endMins,
      );
      return dto.professionalId;
    }

    const profIds = await this.availabilityService.getBusinessProfessionalIds(
      dto.businessId,
    );

    for (const professionalId of profIds) {
      const isFree = await this.isSlotFree(
        dto.date,
        dto.businessId,
        dto.serviceId,
        professionalId,
        startMins,
        endMins,
      );

      if (isFree) return professionalId;
    }

    throw new ConflictException(
      'Nenhum profissional está disponível neste horário.',
    );
  }

  private async isSlotFree(
    date: string,
    businessId: string,
    serviceId: string,
    professionalId: string,
    startMins: number,
    endMins: number,
  ): Promise<boolean> {
    const availableBounds = await this.availabilityService.getAvailableBounds(
      date,
      businessId,
      serviceId,
      professionalId,
    );

    return availableBounds.some((bound) => {
      const boundStart = this.timeToMins(bound.start);
      const boundEnd = this.timeToMins(bound.end);
      return startMins >= boundStart && endMins <= boundEnd;
    });
  }

  private async ensureSlotIsAvailable(
    date: string,
    businessId: string,
    serviceId: string,
    professionalId: string,
    startMins: number,
    endMins: number,
  ): Promise<void> {
    const isFree = await this.isSlotFree(
      date,
      businessId,
      serviceId,
      professionalId,
      startMins,
      endMins,
    );

    if (!isFree) {
      throw new ConflictException(
        'O horário selecionado não está mais disponível.',
      );
    }
  }

  /**
   * Serializa criações concorrentes de agendamento para o mesmo profissional
   * e data via advisory lock do Postgres, liberado automaticamente ao final
   * da transação (commit ou rollback).
   */
  private async lockProfessionalSchedule(
    manager: EntityManager,
    professionalId: string,
    date: string,
  ): Promise<void> {
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `${professionalId}:${date}`,
    ]);
  }

  /**
   * Revalida, já dentro da transação travada, se o horário ainda está livre —
   * cobre o caso de outra reserva ter sido confirmada entre a validação
   * inicial e a obtenção do lock (AC2).
   */
  private async assertNoOverlap(
    manager: EntityManager,
    professionalId: string,
    date: string,
    startMins: number,
    endMins: number,
  ): Promise<void> {
    const existingAppointments = await manager.find(Appointment, {
      where: {
        professional: { id: professionalId },
        date,
        status: In(['PENDING', 'CONFIRMED']),
      },
      select: ['id', 'startTime', 'endTime'],
    });

    const hasConflict = existingAppointments.some((app) => {
      const appStart = this.timeToMins(app.startTime);
      const appEnd = this.timeToMins(app.endTime);
      return Math.max(startMins, appStart) < Math.min(endMins, appEnd);
    });

    if (hasConflict) {
      throw new ConflictException(
        'O horário selecionado não está mais disponível.',
      );
    }
  }

  async getBusySlotsByDate(
    professionalId: string | null,
    date: string,
    statuses: AppointmentStatus[] = ['CONFIRMED'],
    businessId?: string,
  ): Promise<Appointment[]> {
    const where: FindOptionsWhere<Appointment> = {
      date: date,
      status: In(statuses),
    };
    if (professionalId) where.professional = { id: professionalId };
    if (businessId) where.business = { id: businessId };

    return await this.appointmentRepo.find({
      where,
      select: ['id', 'startTime', 'endTime', 'status'],
    });
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

  async cancelAppointment(id: string): Promise<void> {
    await this.appointmentRepo.update(id, { status: 'CANCELLED' });
  }

  async cancelClientAppointment(id: string, clientId: string): Promise<void> {
    const appointment = await this.appointmentRepo.findOne({
      where: { id },
      relations: ['client'],
    });

    if (!appointment)
      throw new NotFoundException('Agendamento não encontrado.');
    if (appointment.client.id !== clientId)
      throw new ForbiddenException(
        'Você não tem permissão para cancelar este agendamento.',
      );
    if (appointment.status !== 'PENDING')
      throw new ForbiddenException(
        'Apenas agendamentos pendentes podem ser cancelados diretamente.',
      );

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
    if (!manager)
      throw new ForbiddenException('Perfil de gestor não encontrado.');

    const link = await this.bmRepo.findOne({
      where: { manager: { id: manager.id }, business: { id: businessId } },
    });

    if (!link)
      throw new ForbiddenException(
        'Você não tem permissão para acessar agendamentos desta empresa.',
      );
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
    if (params.professionalId)
      where.professional = { id: params.professionalId };

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

    if (!appointment)
      throw new NotFoundException('Agendamento não encontrado.');

    await this.validateManagerAuthority(userId, appointment.business.id);

    appointment.status = status;
    return await this.appointmentRepo.save(appointment);
  }
}
