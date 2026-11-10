import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessProfessionalsService } from './business-professionals.service';
import { BusinessProfessionalsController } from './business-professionals.controller';
import { BusinessProfessional } from './entities/business-professional.entity';

import { BusinessManager } from '../business-managers/entities/business-manager.entity';
import { Manager } from '../profiles/managers/entities/manager.entity';
import { BusinessProfessionalService } from './entities/business-professional-service.entity';
import { Professional } from '../profiles/professionals/entities/professional.entity';
import { ProfessionalShift } from '../availability/entities/professional-shift.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BusinessProfessional,
      BusinessProfessionalService,
      BusinessManager,
      Professional,
      ProfessionalShift,
      Manager,
    ]),
  ],
  controllers: [BusinessProfessionalsController],
  providers: [BusinessProfessionalsService],
  exports: [BusinessProfessionalsService],
})
export class BusinessProfessionalsModule {}
