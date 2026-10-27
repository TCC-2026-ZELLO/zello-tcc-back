import {
  IsString,
  IsOptional,
  IsBoolean,
  MaxLength,
  IsTimeZone,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateBusinessProfileDto {
  @ApiPropertyOptional({
    description: 'Nome fantasia atualizado do estabelecimento',
    example: 'Studio Belle Époque Concept',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  tradeName?: string;

  @ApiPropertyOptional({
    description: 'Descrição comercial detalhada do estabelecimento',
    example:
      'Referência em colorimetria, cortes terapêuticos, design de sobrancelhas e estética facial no coração do Batel em Curitiba.',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({
    description: 'Controla se o estabelecimento aparece nas buscas públicas',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  visibilityStatus?: boolean;

  @ApiPropertyOptional({
    description: 'Fuso horário IANA do estabelecimento',
    example: 'America/Sao_Paulo',
  })
  @IsOptional()
  @IsTimeZone({ message: 'timezone deve ser um fuso horário IANA válido.' })
  timezone?: string;
}
