import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { AppointmentStatus } from '../entities/appointment.entity';

export class UpdateAppointmentStatusDto {
  @ApiProperty({
    description: 'Novo status do agendamento atualizado pelo gestor',
    enum: ['CONFIRMED', 'COMPLETED'],
    example: 'CONFIRMED',
  })
  @IsNotEmpty()
  @IsEnum(['CONFIRMED', 'COMPLETED'])
  status!: AppointmentStatus;
}
