import { Controller, Get, HttpStatus, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SearchServicesByLocationService } from './search-services-by-location.service';
import { SearchServicesByLocationDto } from './dto/search-services-by-location.dto';
import { ServiceLocationResponseDto } from './dto/service-location-response.dto';

interface ServicesByLocationHttpResponse {
  status: number;
  data: ServiceLocationResponseDto[];
  total: number;
  message?: string;
}

/**
 * Mapear estabelecimentos por geolocalização.
 */
@ApiTags('services')
@Controller('services')
export class ServicesLocationController {
  constructor(
    private readonly searchServicesByLocationService: SearchServicesByLocationService,
  ) {}

  @Get('location')
  @ApiOperation({
    summary:
      'Busca estabelecimentos ativos com serviços cadastrados dentro do raio fixo de 10km.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de estabelecimentos encontrados (pode ser vazia).',
  })
  @ApiResponse({
    status: 400,
    description: 'Latitude/longitude ausentes ou fora do intervalo válido.',
  })
  async findByLocation(
    @Query() query: SearchServicesByLocationDto,
  ): Promise<ServicesByLocationHttpResponse> {
    const result = await this.searchServicesByLocationService.findServicesByLocation(
      query.latitude,
      query.longitude,
    );

    return { status: HttpStatus.OK, ...result };
  }
}
