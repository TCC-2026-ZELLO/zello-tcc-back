import {
  Injectable,
  ConflictException,
  Inject,
  forwardRef,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
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
      // "Sem Preferência" - buscar todos os profissionais que atendem a empresa
      const shifts = await this.availabilityService['shiftRepo'].find({
        where: {
          businessProfessional: { business: { id: dto.businessId } },
        },
        relations: ['businessProfessional', 'businessProfessional.professional'],
      });
      const profIds = [...new Set(shifts.map((s) => s.businessProfessional.professional.id))];

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
          return startMins >= this.timeToMins(bound.start) && endMins <= this.timeToMins(bound.end);
        });

        if (isFree) {
          targetProfessionalId = pId;
          break; // allocate to the first available professional
        }
      }

      if (!targetProfessionalId) {
        throw new ConflictException('Nenhum profissional está disponível neste horário.');
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
    const where: import('typeorm').FindOptionsWhere<Appointment> = {
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

    if (!appointment) {
      throw new NotFoundException('Agendamento não encontrado.');
    }

    if (appointment.client.id !== clientId) {
      throw new ForbiddenException('Você não tem permissão para cancelar este agendamento.');
    }

    if (appointment.status !== 'PENDING') {
      throw new ForbiddenException('Apenas agendamentos pendentes podem ser cancelados diretamente.');
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

  async findByBusiness(businessId: string, userId: string): Promise<Appointment[]> {
    await this.validateManagerAuthority(userId, businessId);
    
    return await this.appointmentRepo.find({
      where: { business: { id: businessId } },
      relations: ['client', 'professional', 'professional.user', 'service'],
      order: { date: 'DESC', startTime: 'ASC' },
    });
  }

  async updateStatus(id: string, status: AppointmentStatus, userId: string): Promise<Appointment> {
    const appointment = await this.appointmentRepo.findOne({
      where: { id },
      relations: ['business'],
    });

    if (!appointment) throw new NotFoundException('Agendamento não encontrado.');

    await this.validateManagerAuthority(userId, appointment.business.id);

    appointment.status = status;
    return await this.appointmentRepo.save(appointment);
  }
}
