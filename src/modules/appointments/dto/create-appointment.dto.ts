import { IsDateString, IsString, Matches, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAppointmentDto {
  @ApiProperty({ example: 'uuid-da-empresa' })
  //@IsUUID
  @IsString()
  businessId: string;

  @ApiProperty({ example: 'uuid-do-profissional', required: false })
  @IsOptional()
  //@IsUUID
  @IsString()
  professionalId?: string;

  @ApiProperty({ example: 'uuid-do-servico' })
  //@IsUUID
  @IsString()
  serviceId: string;

  @ApiProperty({ example: '2026-04-25' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: '14:30' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Horário deve estar no formato HH:mm',
  })
  startTime: string;
}
