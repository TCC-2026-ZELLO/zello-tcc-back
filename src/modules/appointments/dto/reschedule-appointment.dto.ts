import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, Matches } from 'class-validator';

export class RescheduleAppointmentDto {
  @ApiProperty({ example: '2026-09-10', description: 'Nova data (YYYY-MM-DD)' })
  @IsDateString(
    { strict: false },
    { message: 'date deve estar no formato YYYY-MM-DD' },
  )
  date: string;

  @ApiProperty({
    example: '14:30',
    description: 'Novo horário de início (HH:mm)',
  })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'startTime deve estar no formato HH:mm',
  })
  startTime: string;
}

import { IsBoolean } from 'class-validator';

export class RespondRescheduleDto {
  @ApiProperty({
    example: true,
    description: 'true aceita a proposta do gestor, false a recusa',
  })
  @IsBoolean()
  accept: boolean;
}