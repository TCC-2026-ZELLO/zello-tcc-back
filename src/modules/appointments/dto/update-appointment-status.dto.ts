import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { AppointmentStatus } from '../entities/appointment.entity';

export class UpdateAppointmentStatusDto {
  @ApiProperty({ description: 'O novo status do agendamento (ex: CONFIRMED ou COMPLETED)' })
  @IsNotEmpty()
  @IsEnum(['CONFIRMED', 'COMPLETED'])
  status!: AppointmentStatus;
}
