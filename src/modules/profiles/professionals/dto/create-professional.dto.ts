import { IsUUID, IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateProfessionalDto {
  @IsUUID('4', { message: 'O ID do usuário deve ser um UUID válido.' })
  userId: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsBoolean()
  visibilityStatus?: boolean;
}
