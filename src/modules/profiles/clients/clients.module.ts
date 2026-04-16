import { Module } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { ClientsController } from './clients.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from './entities/client.entity';
import { UsersModule } from '../../users/users.module';

@Module({
  controllers: [ClientsController],
  providers: [ClientsService],
  imports: [TypeOrmModule.forFeature([Client]), UsersModule],
})
export class ClientsModule {}
