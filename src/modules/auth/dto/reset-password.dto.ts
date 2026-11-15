import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { IsAcceptablePassword } from '../../../common/security/password-policy';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Token único recebido no e-mail de recuperação de senha',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @IsNotEmpty({ message: 'O token é obrigatório.' })
  @IsString()
  @Matches(/^[a-f0-9]{64}$/, { message: 'Token inválido.' })
  token: string;

  @ApiProperty({
    description:
      'Nova senha (mínimo de 8 caracteres, contendo maiúscula, minúscula, número e caractere especial)',
    example: 'NovaSenha@2026!',
    minLength: 8,
  })
  @IsNotEmpty({ message: 'A senha é obrigatória.' })
  @IsString()
  @IsAcceptablePassword()
  newPassword: string;
}
