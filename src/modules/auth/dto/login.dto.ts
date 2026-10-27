import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description: 'E-mail cadastrado do usuário',
    example: 'mariana.costa@zello.com.br',
    maxLength: 255,
  })
  @IsNotEmpty({ message: 'O e-mail é obrigatório.' })
  @IsEmail({}, { message: 'Formato de e-mail inválido.' })
  @MaxLength(255)
  email: string;

  @ApiProperty({
    description: 'Senha de acesso da conta',
    example: 'Zello@2026!',
  })
  @IsNotEmpty({ message: 'A senha é obrigatória.' })
  @IsString()
  password: string;
}
