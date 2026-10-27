import { Controller, Get, Query, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { LoggersInterceptor } from '../../common/interceptors/log-interceptor';
import { SucessInterceptor } from '../../common/interceptors/success-interceptor';

@ApiTags('search')
@Controller('search')
@UseInterceptors(LoggersInterceptor, SucessInterceptor)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('professionals')
  @ApiOperation({
    summary: 'Buscar profissionais com filtros de texto, preço, nota e ordenação',
    description:
      'Realiza a busca pública de profissionais visíveis filtrando por termo livre (nome, especialidade ou serviço), faixa de preço (minPrice, maxPrice), avaliação mínima (minRating) e ordenação (default, trending, price_asc).',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de profissionais encontrados retornada com sucesso.',
  })
  async searchProfessionals(@Query() query: SearchQueryDto) {
    return this.searchService.searchProfessionals(query);
  }

  @Get('professionals/recommended')
  @ApiOperation({
    summary: 'Listar profissionais recomendados em destaque',
    description:
      'Retorna os 4 profissionais mais bem avaliados e em destaque na plataforma para exibição na vitrine principal.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de profissionais recomendados retornada com sucesso.',
  })
  async getRecommended() {
    return this.searchService.getRecommended(4);
  }

  @Get('businesses')
  @ApiOperation({
    summary: 'Buscar estabelecimentos com filtros de texto, preço, nota e ordenação',
    description:
      'Realiza a busca pública de estabelecimentos ativos e visíveis filtrando por nome fantasia, serviços oferecidos, faixa de preço, nota mínima de avaliação e critério de ordenação.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de estabelecimentos encontrados retornada com sucesso.',
  })
  async searchBusinesses(@Query() query: SearchQueryDto) {
    return this.searchService.searchBusinesses(query);
  }
}
