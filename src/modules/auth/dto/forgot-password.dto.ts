import { IsEmail, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({
    description: 'E-mail da conta para envio do link de redefinição de senha',
    example: 'mariana.costa@zello.com.br',
    maxLength: 255,
  })
  @IsNotEmpty({ message: 'O e-mail é obrigatório.' })
  @IsEmail({}, { message: 'Formato de e-mail inválido.' })
  @MaxLength(255, { message: 'O e-mail não pode exceder 255 caracteres.' })
  email: string;
}
