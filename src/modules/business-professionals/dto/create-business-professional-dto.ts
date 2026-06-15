import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateBusinessProfessionalDto {
  //@IsUUID()
  @IsString()
  @IsNotEmpty()
  businessId: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
