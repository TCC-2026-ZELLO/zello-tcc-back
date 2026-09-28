import {
  IsString,
  IsOptional,
  IsBoolean,
  MaxLength,
  IsTimeZone,
} from 'class-validator';

export class UpdateBusinessProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  tradeName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsBoolean()
  visibilityStatus?: boolean;

  @IsOptional()
  @IsTimeZone({ message: 'timezone deve ser um fuso horário IANA válido.' })
  timezone?: string;
}
