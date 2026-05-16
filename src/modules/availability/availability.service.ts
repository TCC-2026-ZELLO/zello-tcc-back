import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { BusinessOperatingHour } from './entities/business_operating_hour.entity';
import { ProfessionalShift } from './entities/professional-shift.entity';
import { ScheduleException } from './entities/schedule-exception.entity';

import { CreateBusinessOperatingHourDto } from './dto/create-business-operating-hour.dto';
import { CreateProfessionalShiftDto } from './dto/create-professional-shift.dto';
import { CreateScheduleExceptionDto } from './dto/create-schedule-exception.dto';

import { CatalogService } from '../catalog/catalog.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { BusinessManager } from '../business-managers/entities/business-manager.entity';
import { Manager } from '../profiles/managers/entities/manager.entity';

@Injectable()
export class AvailabilityService {
  constructor(
    @InjectRepository(BusinessOperatingHour)
    private readonly operatingHourRepo: Repository<BusinessOperatingHour>,
    @InjectRepository(ProfessionalShift)
    private readonly shiftRepo: Repository<ProfessionalShift>,
    @InjectRepository(ScheduleException)
    private readonly exceptionRepo: Repository<ScheduleException>,
    @InjectRepository(BusinessManager)
    private readonly bmRepo: Repository<BusinessManager>,
    @InjectRepository(Manager)
    private readonly managerRepo: Repository<Manager>,

    private readonly catalogService: CatalogService,
    private readonly appointmentsService: AppointmentsService,
  ) {}

  async createOperatingHour(
    dto: CreateBusinessOperatingHourDto,
    requester: ActiveUser,
  ) {
    await this.validateManagerAuthority(requester.id, dto.businessId);

    let hour = await this.operatingHourRepo.findOne({
      where: { business: { id: dto.businessId }, dayOfWeek: dto.dayOfWeek },
    });

    if (hour) {
      this.operatingHourRepo.merge(hour, dto);
    } else {
      hour = this.operatingHourRepo.create({
        ...dto,
        business: { id: dto.businessId },
      });
    }

    return await this.operatingHourRepo.save(hour);
  }

  async createShift(dto: CreateProfessionalShiftDto) {
    const { businessProfessionalId, ...rest } = dto;

    const shift = this.shiftRepo.create({
      ...rest,
      businessProfessional: { id: businessProfessionalId },
    });
    return await this.shiftRepo.save(shift);
  }

  async createException(dto: CreateScheduleExceptionDto) {
    const { businessId, professionalId, ...rest } = dto;

    const exception = this.exceptionRepo.create({
      ...rest,
      business: businessId ? { id: businessId } : undefined,
      professional: professionalId ? { id: professionalId } : undefined,
    });
    return await this.exceptionRepo.save(exception);
  }

  private timeToMins(timeStr: string): number {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private minsToTime(mins: number): string {
    const h = Math.floor(mins / 60)
      .toString()
      .padStart(2, '0');
    const m = (mins % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  }

  async getAvailableBounds(
    date: string,
    professionalId: string,
    businessId: string,
    serviceId: string,
  ) {
    const targetDate = new Date(`${date}T12:00:00Z`);
    const dayOfWeek = targetDate.getUTCDay();

    const { totalTime } =
      await this.catalogService.getServiceDuration(serviceId);

    const businessHour = await this.operatingHourRepo.findOne({
      where: { business: { id: businessId }, dayOfWeek },
    });

    if (!businessHour || !businessHour.isOpen) return [];

    const bizStart = this.timeToMins(businessHour.startTime);
    const bizEnd = this.timeToMins(businessHour.endTime);

    const shifts = await this.shiftRepo.find({
      where: {
        dayOfWeek,
        businessProfessional: {
          professional: { id: professionalId },
          business: { id: businessId },
        },
      },
    });

    if (shifts.length === 0) return [];

    const workingBounds: Array<[number, number]> = shifts
      .map((shift): [number, number] => [
        Math.max(bizStart, this.timeToMins(shift.startTime)),
        Math.min(bizEnd, this.timeToMins(shift.endTime)),
      ])
      .filter((bound) => bound[0] < bound[1]);

    workingBounds.sort((a, b) => a[0] - b[0]);
    const mergedWorking: Array<[number, number]> = [];
    for (const b of workingBounds) {
      if (!mergedWorking.length) mergedWorking.push(b);
      else {
        const last = mergedWorking[mergedWorking.length - 1];
        if (b[0] <= last[1]) last[1] = Math.max(last[1], b[1]);
        else mergedWorking.push(b);
      }
    }

    const blockedIntervals: Array<[number, number]> = [];

    const exceptions = await this.exceptionRepo.find({
      where: [
        { date, business: { id: businessId } },
        { date, professional: { id: professionalId } },
      ],
    });

    for (const ex of exceptions) {
      if (!ex.startTime || !ex.endTime) return [];
      blockedIntervals.push([
        this.timeToMins(ex.startTime),
        this.timeToMins(ex.endTime),
      ]);
    }

    const appointments = await this.appointmentsService.getBusySlotsByDate(
      professionalId,
      date,
    );
    for (const app of appointments) {
      blockedIntervals.push([
        this.timeToMins(app.startTime),
        this.timeToMins(app.endTime),
      ]);
    }

    let freeBounds = [...mergedWorking];

    for (const [bStart, bEnd] of blockedIntervals) {
      const nextFree: Array<[number, number]> = [];

      for (const [fStart, fEnd] of freeBounds) {
        if (bEnd <= fStart || bStart >= fEnd) {
          nextFree.push([fStart, fEnd]);
        } else {
          if (fStart < bStart) nextFree.push([fStart, bStart]);
          if (bEnd < fEnd) nextFree.push([bEnd, fEnd]);
        }
      }
      freeBounds = nextFree;
    }

    const validBounds = freeBounds.filter(
      ([start, end]) => end - start >= totalTime,
    );

    return validBounds.map(([start, end]) => ({
      start: this.minsToTime(start),
      end: this.minsToTime(end),
      durationAvailable: end - start,
    }));
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
        'Você não tem permissão para gerenciar esta empresa.',
      );
  }
}
