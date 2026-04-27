import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessesService } from './businesses.service';
import { BusinessesController } from './businesses.controller';
import { Business } from './entities/business.entity';
import { BusinessManager } from '../business-managers/entities/business-manager.entity';
import { UsersModule } from '../users/users.module';
import { Manager } from '../profiles/managers/entities/manager.entity';
import { GalleryImage } from './entities/gallery-image.entity';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Business,
      BusinessManager,
      Manager,
      GalleryImage,
    ]),
    UsersModule,
    FilesModule,
  ],
  controllers: [BusinessesController],
  providers: [BusinessesService],
  exports: [BusinessesService],
})
export class BusinessesModule {}
