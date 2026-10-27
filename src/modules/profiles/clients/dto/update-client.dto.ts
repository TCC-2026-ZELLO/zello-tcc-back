import { IsOptional, IsInt, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateClientDto {
  @ApiPropertyOptional({
    description: 'Contador acumulado de faltas injustificadas (No-Show)',
    example: 1,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  noShowCount?: number;

  @ApiPropertyOptional({
    description:
      'Sequência de comparecimentos consecutivos bem-sucedidos pelo cliente',
    example: 3,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  successStreak?: number;
}
