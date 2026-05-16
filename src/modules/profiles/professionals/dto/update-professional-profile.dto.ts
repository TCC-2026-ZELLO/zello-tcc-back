import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';

export class UpdateProfessionalProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;

  @IsOptional()
  @IsString()
  specialty?: string;

  @IsOptional()
  @IsString()
  instagramUrl?: string;

  @IsOptional()
  @IsBoolean()
  visibilityStatus?: boolean;
}
