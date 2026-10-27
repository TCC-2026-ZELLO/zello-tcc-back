import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDateString, Matches } from 'class-validator';

export class RescheduleAppointmentDto {
  @ApiProperty({
    example: '2026-11-20',
    description: 'Nova data proposta para o atendimento (YYYY-MM-DD)',
  })
  @IsDateString(
    { strict: false },
    { message: 'date deve estar no formato YYYY-MM-DD' },
  )
  date: string;

  @ApiProperty({
    example: '16:00',
    description: 'Novo horário de início proposto para o atendimento (HH:mm)',
  })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'startTime deve estar no formato HH:mm',
  })
  startTime: string;
}

export class RespondRescheduleDto {
  @ApiProperty({
    example: true,
    description:
      'Define a resposta do cliente: true aceita a proposta de novo horário do gestor, false a recusa',
  })
  @IsBoolean()
  accept: boolean;
}
