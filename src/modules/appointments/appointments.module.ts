import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';
import { Appointment } from './entities/appointment.entity';
import { CatalogModule } from '../catalog/catalog.module';
import { AvailabilityModule } from '../availability/availability.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Appointment]),
    CatalogModule,
    forwardRef(() => AvailabilityModule),
  ],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
