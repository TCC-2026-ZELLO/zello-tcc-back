import { forwardRef, Module } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CatalogController } from './catalog.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Service } from './entities/service.entity';
import { BusinessProfessional } from '../business-professionals/entities/business-professional.entity';
import { ProfessionalsModule } from '../profiles/professionals/professionals.module';
import { BusinessManager } from '../business-managers/entities/business-manager.entity';
import { Manager } from '../profiles/managers/entities/manager.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Service,
      BusinessProfessional,
      BusinessManager,
      Manager,
    ]),
    forwardRef(() => ProfessionalsModule),
  ],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService, TypeOrmModule],
})
export class CatalogModule {}
