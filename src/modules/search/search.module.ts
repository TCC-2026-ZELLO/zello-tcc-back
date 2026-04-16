import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { Professional } from '../profiles/professionals/entities/professional.entity';
import { Business } from '../businesses/entities/business.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Professional, Business])],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
