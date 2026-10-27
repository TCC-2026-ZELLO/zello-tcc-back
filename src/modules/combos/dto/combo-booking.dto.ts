import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export class ProfessionalChoiceDto {
  @ApiProperty({
    description: 'UUID do serviço específico dentro do combo',
    example: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  })
  @IsUUID()
  serviceId: string;

  @ApiProperty({
    description: 'UUID do profissional escolhido para executar este serviço',
    example: '3b241101-e2bb-4255-8caf-4136c566a962',
  })
  @IsUUID()
  professionalId: string;
}

export class ComboAvailabilityQueryDto {
  @ApiProperty({
    description: 'Data para consulta de horários sincronizados (YYYY-MM-DD)',
    example: '2026-11-15',
  })
  @Matches(DATE, { message: 'date deve estar no formato YYYY-MM-DD.' })
  date: string;

  @ApiPropertyOptional({
    description: 'Intervalo em minutos entre os horários sugeridos (5 a 60)',
    example: 15,
    minimum: 5,
    maximum: 60,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(60)
  granularity?: number;
}

export class CreateComboBookingDto {
  @ApiProperty({
    description: 'Data desejada para a reserva do combo (YYYY-MM-DD)',
    example: '2026-11-15',
  })
  @Matches(DATE, { message: 'date deve estar no formato YYYY-MM-DD.' })
  date: string;

  @ApiProperty({
    description: 'Horário de início do primeiro serviço do combo (HH:mm)',
    example: '14:00',
  })
  @Matches(TIME, { message: 'startTime deve estar no formato HH:MM.' })
  startTime: string;

  @ApiPropertyOptional({
    description:
      'Escolha opcional de profissionais para cada etapa do combo (se omitido, o sistema aloca os profissionais livres)',
    type: [ProfessionalChoiceDto],
    example: [
      {
        serviceId: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
        professionalId: '3b241101-e2bb-4255-8caf-4136c566a962',
      },
      {
        serviceId: '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed',
        professionalId: '6fa459ea-ee8a-3ca4-894e-db77e160355e',
      },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProfessionalChoiceDto)
  professionals?: ProfessionalChoiceDto[];
}

export class RejectComboBookingDto {
  @ApiProperty({
    description:
      'Justificativa detalhada da recusa ou cancelamento do combo (mínimo 10 caracteres)',
    example:
      'Infelizmente o equipamento de estética facial entrou em manutenção preventiva para esta data.',
    minLength: 10,
  })
  @IsString()
  @MinLength(10, {
    message: 'Descreva o motivo da recusa com pelo menos 10 caracteres.',
  })
  reason: string;
}
