import {
  IsNotEmpty,
  IsString,
  IsBoolean,
  IsOptional,
  IsTimeZone,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBusinessDto {
  @ApiProperty({
    description: 'Nome fantasia do estabelecimento',
    example: 'Studio Belle Époque Curitiba',
  })
  @IsNotEmpty({ message: 'O nome fantasia (tradeName) é obrigatório.' })
  @IsString()
  tradeName: string;

  @ApiPropertyOptional({
    description: 'Indica se o estabelecimento possui pendência financeira',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  defaulting?: boolean;

  @ApiPropertyOptional({
    description:
      'Indica se o perfil do estabelecimento está visível nas buscas públicas',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  visibilityStatus?: boolean;

  @ApiPropertyOptional({
    example: 'America/Sao_Paulo',
    description: 'Fuso horário IANA do estabelecimento.',
  })
  @IsOptional()
  @IsTimeZone({ message: 'timezone deve ser um fuso horário IANA válido.' })
  timezone?: string;
}
