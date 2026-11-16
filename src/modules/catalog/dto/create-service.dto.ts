import {
  IsString,
  IsInt,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateServiceDto {
  @ApiProperty({
    description: 'Nome comercial do serviço oferecido',
    example: 'Corte Masculino + Barba Terapia',
  })
  @IsString()
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({
    description: 'Descrição detalhada dos procedimentos inclusos no serviço',
    example:
      'Corte personalizado na tesoura e máquina, seguido de ritual de barba com toalha quente, óleo essencial e massagem facial.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({
    example: 60,
    description: 'Duração estimada de execução do serviço em minutos',
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  @Max(720)
  durationMinutes: number;

  @ApiProperty({
    example: 15,
    description:
      'Tempo de higienização/preparação pós-serviço em minutos (AC2)',
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  @Max(240)
  cleanupMinutes: number;

  @ApiProperty({
    description: 'Valor cobrado pelo serviço em Reais (BRL)',
    example: 95.0,
  })
  @Type(() => Number)
  // v5.0.0-2.2.1: valor em reais, não negativo, com no máximo 2 casas.
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100000)
  price: number;
}
