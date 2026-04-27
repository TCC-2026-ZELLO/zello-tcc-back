import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AvailabilityService } from './availability.service';
import { AvailabilityController } from './availability.controller';
import { BusinessOperatingHour } from './entities/business_operating_hour.entity';
import { ProfessionalShift } from './entities/professional-shift.entity';
import { ScheduleException } from './entities/schedule-exception.entity';
import { BusinessManager } from '../business-managers/entities/business-manager.entity';
import { Manager } from '../profiles/managers/entities/manager.entity';
import { CatalogModule } from '../catalog/catalog.module';
import { AppointmentsModule } from '../appointments/appointments.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BusinessOperatingHour,
      ProfessionalShift,
      ScheduleException,
      BusinessManager,
      Manager,
    ]),
    CatalogModule,
    AppointmentsModule,
  ],
  controllers: [AvailabilityController],
  providers: [AvailabilityService],
  exports: [AvailabilityService],
})
export class AvailabilityModule {}
