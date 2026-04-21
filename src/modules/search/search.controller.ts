import { Controller, Get, Query, UseInterceptors } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { LoggersInterceptor } from '../../common/interceptors/log-interceptor';
import { SucessInterceptor } from '../../common/interceptors/success-interceptor';

@Controller('search')
@UseInterceptors(LoggersInterceptor, SucessInterceptor)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('professionals')
  async searchProfessionals(@Query() query: SearchQueryDto) {
    return this.searchService.searchProfessionals(query);
  }

  @Get('businesses')
  async searchBusinesses(@Query() query: SearchQueryDto) {
    return this.searchService.searchBusinesses(query);
  }
}
