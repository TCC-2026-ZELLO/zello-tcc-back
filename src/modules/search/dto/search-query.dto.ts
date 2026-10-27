import {
  IsOptional,
  IsString,
  IsEnum,
  IsNumber,
  Min,
  Max,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum SortBy {
  DEFAULT = 'default',
  TRENDING = 'trending',
  PRICE_ASC = 'price_asc',
}

export class SearchQueryDto {
  @ApiPropertyOptional({
    description:
      'Termo livre para busca por nome, especialidade ou serviço (ex.: Barbearia, Colorista, Corte)',
    example: 'Colorista',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    description:
      'Critério de ordenação dos resultados (default, trending por melhor avaliação ou price_asc por menor preço)',
    enum: SortBy,
    example: SortBy.TRENDING,
  })
  @IsOptional()
  @IsEnum(SortBy)
  sortBy?: SortBy;

  @ApiPropertyOptional({
    description: 'Filtro de preço mínimo dos serviços em Reais (BRL)',
    example: 40,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({
    description: 'Filtro de preço máximo dos serviços em Reais (BRL)',
    example: 200,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({
    description: 'Nota média mínima de avaliação (0 a 5)',
    example: 4.5,
    minimum: 0,
    maximum: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  minRating?: number;

  /** Limite de resultados (padrão: 20, máx: 100) */
  @ApiPropertyOptional({
    description: 'Quantidade máxima de registros retornados (padrão: 20, máx: 100)',
    example: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
