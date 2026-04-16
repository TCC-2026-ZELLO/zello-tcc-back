import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';

export class UpdateProfessionalProfileDto {
  @IsOptional()
  @IsString({ message: 'The bio should be a valid text' })
  @MaxLength(1000, { message: 'The bio should not exceed 1000 characters' })
  bio?: string;
  @IsOptional()
  @IsBoolean({
    message: 'The visibility status must ba a boolean',
  })
  visibilityStatus?: boolean;
}
