import { Module } from '@nestjs/common';
import { ManagersService } from './managers.service';
import { ManagersController } from './managers.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../../users/users.module';
import { Manager } from './entities/manager.entity';

@Module({
  controllers: [ManagersController],
  providers: [ManagersService],
  imports: [TypeOrmModule.forFeature([Manager]), UsersModule],
})
export class ManagersModule {}
