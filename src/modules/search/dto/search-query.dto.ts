import { IsOptional, IsString, IsEnum } from 'class-validator';

export enum SearchFilter {
  TRENDING = 'trending',
  PRICE_ASC = 'price_asc',
  RATING = 'rating',
  TODAY = 'today',
}

export class SearchQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsEnum(SearchFilter)
  filter?: SearchFilter;

  @IsOptional()
  lat?: number;

  @IsOptional()
  lng?: number;
}
