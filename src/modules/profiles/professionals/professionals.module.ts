import { Module } from '@nestjs/common';
import { ProfessionalsService } from './professionals.service';
import { ProfessionalsController } from './professionals.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../../users/users.module';
import { Professional } from './entities/professional.entity';
import { User } from '../../users/entities/user.entity';
import { Role } from '../../users/entities/role.entity';

@Module({
  controllers: [ProfessionalsController],
  providers: [ProfessionalsService],
  imports: [TypeOrmModule.forFeature([Professional, User, Role]), UsersModule],
})
export class ProfessionalsModule {}
