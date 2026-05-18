import {
  ForbiddenException,
  Injectable,
  BadRequestException,
  ConflictException,
  PreconditionFailedException,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';

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
import { Professional } from '../profiles/professionals/entities/professional.entity';

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
    @InjectRepository(Professional)
    private readonly profRepo: Repository<Professional>,

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

  async createException(
    dto: CreateScheduleExceptionDto,
    requester: ActiveUser,
  ) {
    const {
      businessId,
      professionalId,
      date,
      dates,
      skipConflicts,
      forceOverwritePending,
      ...rest
    } = dto;
    const targetDates = dates || (date ? [date] : []);

    if (targetDates.length === 0) {
      throw new BadRequestException('Informe ao menos uma data.');
    }

    if (
      requester.roles.includes('professional') &&
      !requester.roles.includes('manager') &&
      !requester.roles.includes('admin')
    ) {
      const prof = await this.profRepo.findOne({
        where: { user: { id: requester.id } },
      });
      if (!prof || prof.id !== professionalId) {
        throw new ForbiddenException(
          'Acesso negado: profissionais só podem bloquear sua própria agenda.',
        );
      }
    } else if (requester.roles.includes('manager') && businessId) {
      await this.validateManagerAuthority(requester.id, businessId);
    }

    const seriesId = targetDates.length > 1 ? crypto.randomUUID() : undefined;
    const savedExceptions: ScheduleException[] = [];
    const conflicts: string[] = [];
    let hasPending = false;

    for (const d of targetDates) {
      if (dto.startTime && dto.endTime) {
        const appointments = await this.appointmentsService.getBusySlotsByDate(
          professionalId || null,
          d,
          ['CONFIRMED', 'PENDING'],
          businessId,
        );

        const sMins = this.timeToMins(dto.startTime);
        const eMins = this.timeToMins(dto.endTime);

        const overlapping = appointments.filter((app) => {
          const appStart = this.timeToMins(app.startTime);
          const appEnd = this.timeToMins(app.endTime);
          return Math.max(sMins, appStart) < Math.min(eMins, appEnd);
        });

        if (overlapping.length > 0) {
          const hasConfirmed = overlapping.some(
            (o) => o.status === 'CONFIRMED',
          );
          const pendingApps = overlapping.filter((o) => o.status === 'PENDING');

          if (hasConfirmed) {
            conflicts.push(d);
            continue;
          }

          if (pendingApps.length > 0) {
            if (forceOverwritePending) {
              for (const p of pendingApps) {
                await this.appointmentsService.cancelAppointment(p.id);
              }
            } else {
              hasPending = true;
              conflicts.push(d);
              continue;
            }
          }
        }
      }

      const exception = this.exceptionRepo.create({
        ...rest,
        date: d,
        seriesId: seriesId,
        business: businessId ? { id: businessId } : undefined,
        professional: professionalId ? { id: professionalId } : undefined,
      });
      savedExceptions.push(exception);
    }

    if (hasPending && !forceOverwritePending) {
      throw new PreconditionFailedException({
        message: 'Há reservas pendentes neste horário.',
        hasPending: true,
        conflicts,
      });
    }

    if (conflicts.length > 0 && !skipConflicts) {
      throw new ConflictException({
        message: 'Conflito de horários nas datas fornecidas.',
        conflicts,
      });
    }

    return await this.exceptionRepo.save(savedExceptions);
  }

  async getExceptions(professionalId?: string, businessId?: string, date?: string) {
    const where: any = {};
    if (professionalId) {
      where.professional = { id: professionalId };
    } else if (businessId) {
      where.business = { id: businessId };
    }
    if (date) {
      where.date = date;
    }

    return await this.exceptionRepo.find({
      where,
      order: { date: 'ASC', startTime: 'ASC' },
      relations: ['professional', 'business'],
    });
  }

  async deleteException(id: string, requester: ActiveUser) {
    const exception = await this.exceptionRepo.findOne({
      where: { id },
      relations: ['professional', 'business'],
    });
    if (!exception) throw new NotFoundException('Bloqueio não encontrado');

    if (
      requester.roles.includes('professional') &&
      !requester.roles.includes('manager') &&
      !requester.roles.includes('admin')
    ) {
      const prof = await this.profRepo.findOne({
        where: { user: { id: requester.id } },
      });
      if (!prof || prof.id !== exception.professional?.id) {
        throw new ForbiddenException('Acesso negado.');
      }
    } else if (requester.roles.includes('manager') && exception.business) {
      await this.validateManagerAuthority(requester.id, exception.business.id);
    }

    await this.exceptionRepo.remove(exception);
    return { success: true };
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
      professionalId || null,
      date,
      ['CONFIRMED'],
      businessId,
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
