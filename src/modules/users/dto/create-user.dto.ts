import { IsEmail, IsNotEmpty, MinLength, Equals, IsString } from 'class-validator';

export class CreateUserDto {
  @IsString({ message: 'O nome deve ser um texto válido.' })
  @IsNotEmpty({ message: 'O nome é obrigatório.' })
  nome!: string;

  @IsEmail({}, { message: 'O e-mail informado é inválido.' })
  @IsNotEmpty({ message: 'O e-mail é obrigatório.' })
  email!: string;

  @MinLength(6, { message: 'A senha deve ter no mínimo 6 caracteres.' })
  @IsNotEmpty({ message: 'A senha é obrigatória.' })
  password!: string;

  // CA4
  @Equals(true, { message: 'Você precisa aceitar os termos de uso para criar uma conta.' })
  termosAceitos!: boolean;
}
