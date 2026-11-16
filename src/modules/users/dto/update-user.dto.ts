import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { IsAcceptablePassword } from '../../../common/security/password-policy';

/**
 * Campos que o próprio usuário pode alterar na conta (v5.0.0-15.3.3).
 *
 * A lista é explícita: papel, CPF, tipo de conta, status e demais atributos do
 * cadastro não podem ser enviados aqui. Com `whitelist` e
 * `forbidNonWhitelisted` no ValidationPipe global, qualquer outro campo faz a
 * requisição ser recusada com 400.
 */
export class UpdateUserDto {
  @ApiPropertyOptional({ description: 'Nome completo', maxLength: 120 })
  @IsOptional()
  @IsString({ message: 'O nome deve ser um texto válido.' })
  @MaxLength(120, { message: 'O nome deve ter no máximo 120 caracteres.' })
  nome?: string;

  @ApiPropertyOptional({
    description:
      'Novo e-mail de acesso. Exige `currentPassword` (reautenticação, v5.0.0-7.5.1).',
    maxLength: 254,
  })
  @IsOptional()
  @IsEmail({}, { message: 'O e-mail informado é inválido.' })
  @MaxLength(254, { message: 'O e-mail deve ter no máximo 254 caracteres.' })
  email?: string;

  @ApiPropertyOptional({
    description:
      'Nova senha (mínimo de 8 caracteres, sem regras de composição, fora da lista de senhas comuns). Exige `currentPassword`.',
  })
  @IsOptional()
  @IsString()
  @IsAcceptablePassword()
  password?: string;

  @ApiPropertyOptional({
    description: 'Senha atual, obrigatória para alterar a senha ou o e-mail',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  currentPassword?: string;

  @ApiPropertyOptional({ description: 'Receber lembretes por e-mail' })
  @IsOptional()
  @IsBoolean()
  wantsEmailReminders?: boolean;

  @ApiPropertyOptional({ description: 'Receber lembretes por WhatsApp' })
  @IsOptional()
  @IsBoolean()
  wantsWhatsappReminders?: boolean;
}
