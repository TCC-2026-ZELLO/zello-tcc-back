import {
  IsEmail,
  IsNotEmpty,
  MinLength,
  Equals,
  IsString,
  Matches,
  IsIn,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({
    description: 'Nome completo do usuário',
    example: 'João da Silva',
  })
  @IsString({ message: 'O nome deve ser um texto válido.' })
  @IsNotEmpty({ message: 'O nome é obrigatório.' })
  nome!: string;

  @ApiProperty({
    description: 'E-mail único do usuário',
    example: 'joao@email.com',
  })
  @IsEmail({}, { message: 'O e-mail informado é inválido.' })
  @IsNotEmpty({ message: 'O e-mail é obrigatório.' })
  email!: string;

    @ApiProperty({
    description: 'Senha com no mínimo 6 caracteres',
    example: 'senha123',
    minLength: 6,
  })
  @IsNotEmpty({ message: 'A senha é obrigatória.' })
  @IsString()
  @MinLength(8, { message: 'A senha deve ter no mínimo 8 caracteres.' })
  @Matches(/(?=.*\d)(?=.*\W+)(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'A senha é muito fraca. Ela deve conter letras maiúsculas, números e caracteres especiais.',
  })
  password!: string;

  // CA4
    @ApiProperty({
    description: 'Aceite dos termos de uso — deve ser true para prosseguir',
    example: true,
  })
  @IsBoolean()
  @Equals(true, {
    message: 'Você precisa aceitar os termos de uso para criar uma conta.',
  })
  termosAceitos!: boolean;

  @ApiProperty({
    description: 'Tipo de perfil da conta',
    example: 'CLIENTE',
    enum: ['CLIENTE', 'PROFISSIONAL', 'ESTABELECIMENTO'],
  })
  @IsString()
  @IsNotEmpty({ message: 'O perfil da conta é obrigatório.' })
  @IsIn(['CLIENTE', 'PROFISSIONAL', 'ESTABELECIMENTO'], {
    message: 'O perfil informado é inválido.',
  })
  accountType!: string;
}
