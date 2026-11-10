import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Address } from './entities/address.entity';
import { AddressesService } from './addresses.service';

@Module({
  imports: [TypeOrmModule.forFeature([Address])],
  providers: [AddressesService],
  exports: [AddressesService, TypeOrmModule],
})
export class AddressesModule {}
