import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class CreateBusinessProfessionalDto {
  @IsUUID()
  @IsNotEmpty()
  businessId: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
