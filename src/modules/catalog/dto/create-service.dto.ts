import {
  IsString,
  IsInt,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateServiceDto {
  @ApiProperty({ example: 'Corte de Cabelo' })
  @IsString()
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 45, description: 'Duração em minutos' })
  @IsInt()
  @Min(1)
  durationMinutes: number;

  @ApiProperty({
    example: 15,
    description: 'Tempo de limpeza pós-serviço (AC2)',
  })
  @IsInt()
  @Min(0)
  cleanupMinutes: number;

  @ApiProperty({ example: 50.0 })
  @Type(() => Number)
  @IsNumber()
  price: number;
}
