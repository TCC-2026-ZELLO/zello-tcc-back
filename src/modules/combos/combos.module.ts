import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Combo } from './entities/combo.entity';
import { ComboItem } from './entities/combo-item.entity';
import { AppointmentGroup } from './entities/appointment-group.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { Service } from '../catalog/entities/service.entity';
import { Manager } from '../profiles/managers/entities/manager.entity';
import { BusinessManager } from '../business-managers/entities/business-manager.entity';
import { BusinessProfessional } from '../business-professionals/entities/business-professional.entity';

import { CombosService } from './combos.service';
import { ComboAvailabilityService } from './combo-availability.service';
import { ComboBookingsService } from './combo-bookings.service';
import { CombosController } from './combos.controller';
import { ComboBookingsController } from './combo-bookings.controller';
import { AvailabilityModule } from '../availability/availability.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Combo,
      ComboItem,
      AppointmentGroup,
      Appointment,
      Service,
      Manager,
      BusinessManager,
      BusinessProfessional,
    ]),
    forwardRef(() => AvailabilityModule),
  ],
  controllers: [CombosController, ComboBookingsController],
  providers: [CombosService, ComboAvailabilityService, ComboBookingsService],
  exports: [CombosService, ComboAvailabilityService, ComboBookingsService],
})
export class CombosModule {}
