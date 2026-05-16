import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';

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
}
