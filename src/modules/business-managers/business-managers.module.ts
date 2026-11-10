import { Module } from '@nestjs/common';
import { BusinessManagersService } from './business-managers.service';
import { BusinessManagersController } from './business-managers.controller';
import { BusinessManager } from './entities/business-manager.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Manager } from '../profiles/managers/entities/manager.entity';

@Module({
  imports: [TypeOrmModule.forFeature([BusinessManager, Manager])],
  controllers: [BusinessManagersController],
  providers: [BusinessManagersService],
  exports: [BusinessManagersService],
})
export class BusinessManagersModule {}
