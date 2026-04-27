import {
  Injectable,
  ConflictException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appointment } from './entities/appointment.entity';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { CatalogService } from '../catalog/catalog.service';
import { AvailabilityService } from '../availability/availability.service';

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,

    @Inject(forwardRef(() => AvailabilityService))
    private readonly availabilityService: AvailabilityService,

    private readonly catalogService: CatalogService,
  ) {}

  async create(
    dto: CreateAppointmentDto,
    clientId: string,
  ): Promise<Appointment> {
    const { totalTime } = await this.catalogService.getServiceDuration(
      dto.serviceId,
    );

    const availableBounds = await this.availabilityService.getAvailableBounds(
      dto.date,
      dto.professionalId,
      dto.businessId,
      dto.serviceId,
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
      professional: { id: dto.professionalId },
      business: { id: dto.businessId },
      service: { id: dto.serviceId },
      status: 'SCHEDULED',
    });

    return await this.appointmentRepo.save(appointment);
  }

  async getBusySlotsByDate(
    professionalId: string,
    date: string,
  ): Promise<Appointment[]> {
    return await this.appointmentRepo.find({
      where: {
        professional: { id: professionalId },
        date: date,
        status: 'SCHEDULED',
      },
      select: ['startTime', 'endTime'],
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
}
