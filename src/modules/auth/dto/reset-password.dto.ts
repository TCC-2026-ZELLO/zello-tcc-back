import { IsNotEmpty, IsString, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Token único recebido no e-mail de recuperação de senha',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @IsNotEmpty({ message: 'O token é obrigatório.' })
  @IsString()
  token: string;

  @ApiProperty({
    description:
      'Nova senha (mínimo de 8 caracteres, contendo maiúscula, minúscula, número e caractere especial)',
    example: 'NovaSenha@2026!',
    minLength: 8,
  })
  @IsNotEmpty({ message: 'A senha é obrigatória.' })
  @IsString()
  @MinLength(8, { message: 'A senha deve ter no mínimo 8 caracteres.' })
  @Matches(/(?=.*\d)(?=.*\W+)(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'A senha deve conter letras maiúsculas, minúsculas, números e caracteres especiais.',
  })
  newPassword: string;
}
