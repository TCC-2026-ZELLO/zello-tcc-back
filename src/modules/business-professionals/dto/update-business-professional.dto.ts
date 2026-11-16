import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
const TIME_HHMMSS = /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/;

/**
 * v5.0.0-15.3.3: o vínculo só aceita a alteração do campo `active`.
 * Estabelecimento e profissional não podem ser trocados por esta rota.
 */
export class UpdateBusinessProfessionalDto {
  @ApiPropertyOptional({ description: 'Vínculo ativo ou inativo' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateProfessionalServicesDto {
  @ApiProperty({
    description: 'Lista de UUIDs dos serviços habilitados para este profissional',
    example: [
      '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
      '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed',
    ],
    type: [String],
  })
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID(undefined, { each: true })
  serviceIds: string[];
}

export class ProfessionalShiftItemDto {
  @ApiProperty({
    description: 'Dia da semana (0 = Domingo ... 6 = Sábado)',
    example: 1,
  })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @ApiProperty({
    description: 'Horário inicial do turno (HH:mm:ss)',
    example: '09:00:00',
  })
  @Matches(TIME_HHMMSS, { message: 'startTime deve estar no formato HH:mm:ss.' })
  startTime: string;

  @ApiProperty({
    description: 'Horário final do turno (HH:mm:ss)',
    example: '18:00:00',
  })
  @Matches(TIME_HHMMSS, { message: 'endTime deve estar no formato HH:mm:ss.' })
  endTime: string;
}

export class UpdateProfessionalShiftsDto {
  @ApiProperty({
    description: 'Lista completa de turnos semanais do profissional',
    type: [ProfessionalShiftItemDto],
    example: [
      { dayOfWeek: 1, startTime: '09:00:00', endTime: '18:00:00' },
      { dayOfWeek: 2, startTime: '09:00:00', endTime: '18:00:00' },
      { dayOfWeek: 3, startTime: '13:00:00', endTime: '20:00:00' },
    ],
  })
  @IsArray()
  @ArrayMaxSize(7 * 4)
  @ValidateNested({ each: true })
  @Type(() => ProfessionalShiftItemDto)
  shifts: ProfessionalShiftItemDto[];
}
