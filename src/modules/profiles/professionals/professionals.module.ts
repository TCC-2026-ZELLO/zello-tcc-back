import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfessionalsService } from './professionals.service';
import { ProfessionalsController } from './professionals.controller';
import { Professional } from './entities/professional.entity';
import { PortfolioImage } from './entities/portfolio-image.entity';
import { BusinessProfessionalService } from '../../business-professionals/entities/business-professional-service.entity';
import { User } from '../../users/entities/user.entity';
import { Role } from '../../users/entities/role.entity';
import { Service } from '../../catalog/entities/service.entity';
import { UsersModule } from '../../users/users.module';
import { CatalogModule } from '../../catalog/catalog.module';
import { FilesModule } from '../../files/files.module';

@Module({
  controllers: [ProfessionalsController],
  providers: [ProfessionalsService],
  imports: [
    TypeOrmModule.forFeature([
      Professional,
      PortfolioImage,
      BusinessProfessionalService,
      User,
      Role,
      Service,
    ]),
    UsersModule,
    FilesModule,
    forwardRef(() => CatalogModule),
  ],
  exports: [ProfessionalsService],
})
export class ProfessionalsModule {}
