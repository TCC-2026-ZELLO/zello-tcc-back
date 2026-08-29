import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Business } from '../businesses/entities/business.entity';
import { ServicesLocationController } from './services-location.controller';
import { SearchServicesByLocationService } from './search-services-by-location.service';
import { BusinessGeolocationRepository } from './repositories/business-geolocation.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Business])],
  controllers: [ServicesLocationController],
  providers: [SearchServicesByLocationService, BusinessGeolocationRepository],
  exports: [SearchServicesByLocationService],
})
export class ServicesLocationModule {}
