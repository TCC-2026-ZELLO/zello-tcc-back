import { Injectable } from '@nestjs/common';
import { BusinessGeolocationRepository } from './repositories/business-geolocation.repository';
import { ServiceLocationResponseDto } from './dto/service-location-response.dto';
import { ServicesByLocationResultDto } from './dto/services-by-location-result.dto';
import { RawBusinessGeoRow } from './interfaces/raw-business-geo-row.interface';
import { NO_RESULTS_MESSAGE, SERVICES_SEARCH_RADIUS_KM } from './constants/geo-search.constants';

const DEFAULT_CATEGORY = 'Estabelecimento';

@Injectable()
export class SearchServicesByLocationService {
  constructor(
    private readonly businessGeolocationRepository: BusinessGeolocationRepository,
  ) {}

  async findServicesByLocation(
    latitude: number,
    longitude: number,
  ): Promise<ServicesByLocationResultDto> {
    const rows = await this.businessGeolocationRepository.findByGeolocation(
      latitude,
      longitude,
      SERVICES_SEARCH_RADIUS_KM,
    );

    const data = rows.map((row) => this.toResponseDto(row));

    if (data.length === 0) {
      return { data, total: 0, message: NO_RESULTS_MESSAGE };
    }

    return { data, total: data.length };
  }


  private toResponseDto(row: RawBusinessGeoRow): ServiceLocationResponseDto {
    return {
      id: row.id,
      name: row.trade_name,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      rating: Number(row.average_rating),
      category: row.category ?? DEFAULT_CATEGORY,
      services: row.services_summary ?? '',
      distanceKm: this.roundToTwoDecimals(Number(row.distance_km)),
    };
  }

  /**
   * Arredonda para duas casas decimais.
   */
  private roundToTwoDecimals(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
