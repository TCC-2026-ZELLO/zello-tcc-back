import {
  IsString,
  IsInt,
  IsNumber,
  IsOptional,
  IsUUID,
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
  name: string;

  @ApiPropertyOptional({
    description: 'Descrição detalhada dos procedimentos inclusos no serviço',
    example:
      'Corte personalizado na tesoura e máquina, seguido de ritual de barba com toalha quente, óleo essencial e massagem facial.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: 60,
    description: 'Duração estimada de execução do serviço em minutos',
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  durationMinutes: number;

  @ApiProperty({
    example: 15,
    description:
      'Tempo de higienização/preparação pós-serviço em minutos (AC2)',
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  cleanupMinutes: number;

  @ApiProperty({
    description: 'Valor cobrado pelo serviço em Reais (BRL)',
    example: 95.0,
  })
  @Type(() => Number)
  @IsNumber()
  price: number;
}
