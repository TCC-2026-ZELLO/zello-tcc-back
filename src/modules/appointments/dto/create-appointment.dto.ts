import { IsDateString, IsString, Matches, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAppointmentDto {
  @ApiProperty({
    description: 'UUID do estabelecimento onde será realizado o atendimento',
    example: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  })
  //@IsUUID
  @IsString()
  businessId: string;

  @ApiPropertyOptional({
    description:
      'UUID do profissional escolhido (opcional; se omitido, o sistema aloca um profissional disponível habilitado)',
    example: '3b241101-e2bb-4255-8caf-4136c566a962',
  })
  @IsOptional()
  //@IsUUID
  @IsString()
  professionalId?: string;

  @ApiProperty({
    description: 'UUID do serviço do catálogo a ser agendado',
    example: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  })
  //@IsUUID
  @IsString()
  serviceId: string;

  @ApiProperty({
    description: 'Data desejada para o agendamento no formato YYYY-MM-DD',
    example: '2026-11-15',
  })
  @IsDateString()
  date: string;

  @ApiProperty({
    description: 'Horário de início desejado no formato HH:mm',
    example: '14:30',
  })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Horário deve estar no formato HH:mm',
  })
  startTime: string;
}
