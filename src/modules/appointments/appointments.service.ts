import {
  Injectable,
  ConflictException,
  Inject,
  forwardRef,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, FindOptionsWhere } from 'typeorm';
import { Appointment, AppointmentStatus } from './entities/appointment.entity';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { CatalogService } from '../catalog/catalog.service';
import { AvailabilityService } from '../availability/availability.service';
import { BusinessManager } from '../business-managers/entities/business-manager.entity';
import { Manager } from '../profiles/managers/entities/manager.entity';
import { Client } from '../profiles/clients/entities/client.entity';

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

    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
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
        const pBounds = await this.availabilityService.getAvailableBounds(
          dto.date,
          dto.businessId,
          dto.serviceId,
          pId,
        );

        const startMins = this.timeToMins(dto.startTime);
        const endMins = startMins + totalTime;

        const isFree = pBounds.some((bound) => {
          return (
            startMins >= this.timeToMins(bound.start) &&
            endMins <= this.timeToMins(bound.end)
          );
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

    const availableBounds = await this.availabilityService.getAvailableBounds(
      dto.date,
      dto.businessId,
      dto.serviceId,
      targetProfessionalId,
    );

    const startMins = this.timeToMins(dto.startTime);
    const endMins = startMins + totalTime;

    const isValid = availableBounds.some((bound) => {
      const boundStart = this.timeToMins(bound.start);
      const boundEnd = this.timeToMins(bound.end);
      return startMins >= boundStart && endMins <= boundEnd;
    });

    if (!isValid) {
      throw new ConflictException(
        'O horário selecionado não está mais disponível.',
      );
    }

    const appointment = this.appointmentRepo.create({
      date: dto.date,
      startTime: dto.startTime,
      endTime: this.minsToTime(endMins),
      client: { id: clientId },
      professional: { id: targetProfessionalId },
      business: { id: dto.businessId },
      service: { id: dto.serviceId },
      status: 'PENDING',
    });
    return await this.appointmentRepo.save(appointment);
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
    
    if (appointment.status !== 'PENDING' && appointment.status !== 'CONFIRMED') {
      throw new ForbiddenException(
        'Apenas agendamentos pendentes ou confirmados podem ser cancelados.',
      );
    }

    if (appointment.status === 'CONFIRMED') {
      const now = new Date();
      const appDateTime = new Date(`${appointment.date}T${appointment.startTime}:00-03:00`);
      
      const isWithinGracePeriod = appointment.confirmedAt && (now.getTime() - appointment.confirmedAt.getTime() <= 15 * 60 * 1000);
      const isMoreThan2HoursBefore = (appDateTime.getTime() - now.getTime()) >= 2 * 60 * 60 * 1000;

      if (!isWithinGracePeriod && !isMoreThan2HoursBefore) {
        throw new ForbiddenException(
          'O prazo de cancelamento de 2h expirou. Entre em contato com o estabelecimento.',
        );
      }
    }

    await this.appointmentRepo.update(id, { 
      status: 'CANCELLED',
      cancelledByRole: 'client'
    });
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
      relations: ['business', 'client'],
    });

    if (!appointment)
      throw new NotFoundException('Agendamento não encontrado.');

    await this.validateManagerAuthority(userId, appointment.business.id);

    if (status === 'CONFIRMED') {
      appointment.confirmedAt = new Date();
    } else if (status === 'COMPLETED' && appointment.status !== 'COMPLETED') {
      if (appointment.client) {
        const clientProfile = await this.clientRepo.findOne({ where: { user: { id: appointment.client.id } } });
        if (clientProfile) {
          clientProfile.successStreak = (clientProfile.successStreak || 0) + 1;
          clientProfile.noShowCount = 0;
          await this.clientRepo.save(clientProfile);
        }
      }
    }

    appointment.status = status;
    return await this.appointmentRepo.save(appointment);
  }

  async markNoShow(id: string, userId: string): Promise<Appointment> {
    const appointment = await this.appointmentRepo.findOne({
      where: { id },
      relations: ['business', 'client'],
    });

    if (!appointment)
      throw new NotFoundException('Agendamento não encontrado.');

    await this.validateManagerAuthority(userId, appointment.business.id);

    const now = new Date();
    const appDateTime = new Date(`${appointment.date}T${appointment.startTime}:00-03:00`);

    if (now <= appDateTime) {
      throw new ForbiddenException('Não é possível marcar No-Show antes do horário do serviço.');
    }

    if (appointment.status !== 'CONFIRMED' && appointment.status !== 'NO_SHOW') {
      throw new ForbiddenException('Apenas agendamentos confirmados podem ser marcados como No-Show.');
    }
    
    if (appointment.cancelledByRole !== 'manager_noshow') {
      if (appointment.client) {
        const clientProfile = await this.clientRepo.findOne({ where: { user: { id: appointment.client.id } } });
        if (clientProfile) {
          clientProfile.noShowCount = (clientProfile.noShowCount || 0) + 1;
          clientProfile.successStreak = 0;
          await this.clientRepo.save(clientProfile);
        }
      }
      appointment.status = 'NO_SHOW';
      appointment.cancelledByRole = 'manager_noshow';
      return await this.appointmentRepo.save(appointment);
    }

    return appointment;
  }

  async revertNoShow(id: string, userId: string): Promise<Appointment> {
    const appointment = await this.appointmentRepo.findOne({
      where: { id },
      relations: ['business', 'client'],
    });

    if (!appointment)
      throw new NotFoundException('Agendamento não encontrado.');

    await this.validateManagerAuthority(userId, appointment.business.id);

    if (appointment.status !== 'NO_SHOW') {
      throw new ForbiddenException('Apenas agendamentos com status NO_SHOW podem ser revertidos.');
    }

    if (appointment.client) {
      const clientProfile = await this.clientRepo.findOne({ where: { user: { id: appointment.client.id } } });
      if (clientProfile) {
        if (appointment.cancelledByRole === 'manager_noshow') {
          clientProfile.noShowCount = Math.max(0, (clientProfile.noShowCount || 0) - 1);
        } else {
          clientProfile.successStreak = (clientProfile.successStreak || 0) + 1;
          clientProfile.noShowCount = 0;
        }
        await this.clientRepo.save(clientProfile);
      }
    }

    appointment.status = 'COMPLETED'; // Assuming reverting means the client actually showed up and completed
    appointment.cancelledByRole = null;
    return await this.appointmentRepo.save(appointment);
  }

  async cancelJustified(id: string, userId: string, reason: string, affectsReputation: boolean): Promise<Appointment> {
    const appointment = await this.appointmentRepo.findOne({
      where: { id },
      relations: ['business', 'client'],
    });

    if (!appointment)
      throw new NotFoundException('Agendamento não encontrado.');

    await this.validateManagerAuthority(userId, appointment.business.id);

    appointment.status = 'CANCELLED';
    appointment.cancellationReason = reason;

    if (affectsReputation) {
      appointment.cancelledByRole = 'manager';
      if (appointment.client) {
        const clientProfile = await this.clientRepo.findOne({ where: { user: { id: appointment.client.id } } });
        if (clientProfile) {
          clientProfile.noShowCount = (clientProfile.noShowCount || 0) + 1;
          clientProfile.successStreak = 0;
          await this.clientRepo.save(clientProfile);
        }
      }
    } else {
      appointment.cancelledByRole = 'manager_justified';
    }

    return await this.appointmentRepo.save(appointment);
  }

  async getClientReputation(id: string): Promise<{ noShowCount: number; successStreak: number }> {
    const client = await this.clientRepo.findOne({
      where: [{ id }, { user: { id } }],
    });
    if (!client) throw new NotFoundException('Perfil de cliente não encontrado.');
    return {
      noShowCount: client.noShowCount || 0,
      successStreak: client.successStreak || 0,
    };
  }
}
