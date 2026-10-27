import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBusinessProfessionalDto {
  @ApiProperty({
    description: 'UUID do estabelecimento que está contratando/vinculando',
    example: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  })
  //@IsUUID()
  @IsString()
  @IsNotEmpty()
  businessId: string;

  @ApiProperty({
    description: 'E-mail cadastrado do profissional que será vinculado',
    example: 'lucas.barbeiro@zello.com.br',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({
    description: 'Define se o vínculo já inicia ativo para agendamentos',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
