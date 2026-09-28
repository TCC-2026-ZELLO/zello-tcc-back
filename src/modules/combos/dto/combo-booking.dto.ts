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

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export class ProfessionalChoiceDto {
  @IsUUID()
  serviceId: string;

  @IsUUID()
  professionalId: string;
}

export class ComboAvailabilityQueryDto {
  @Matches(DATE, { message: 'date deve estar no formato YYYY-MM-DD.' })
  date: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(60)
  granularity?: number;
}

export class CreateComboBookingDto {
  @Matches(DATE, { message: 'date deve estar no formato YYYY-MM-DD.' })
  date: string;

  @Matches(TIME, { message: 'startTime deve estar no formato HH:MM.' })
  startTime: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProfessionalChoiceDto)
  professionals?: ProfessionalChoiceDto[];
}

export class RejectComboBookingDto {
  @IsString()
  @MinLength(10, {
    message: 'Descreva o motivo da recusa com pelo menos 10 caracteres.',
  })
  reason: string;
}
