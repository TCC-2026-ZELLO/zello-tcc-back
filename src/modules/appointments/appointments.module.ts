import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsCronService } from './appointments-cron.service';
import { Appointment } from './entities/appointment.entity';
import { AppointmentReschedule } from './entities/appointment-reschedule.entity';
import { CatalogModule } from '../catalog/catalog.module';
import { AvailabilityModule } from '../availability/availability.module';
import { BusinessManager } from '../business-managers/entities/business-manager.entity';
import { Manager } from '../profiles/managers/entities/manager.entity';
import { Client } from '../profiles/clients/entities/client.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Appointment,
      AppointmentReschedule,
      BusinessManager,
      Manager,
    ]),
    TypeOrmModule.forFeature([Appointment, BusinessManager, Manager, Client]),
    CatalogModule,
    forwardRef(() => AvailabilityModule),
  ],
  controllers: [AppointmentsController],
  providers: [AppointmentsService, AppointmentsCronService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
