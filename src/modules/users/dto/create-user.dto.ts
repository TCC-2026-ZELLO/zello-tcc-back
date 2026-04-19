import {
  IsEmail,
  IsNotEmpty,
  MinLength,
  Equals,
  IsString,
  Matches,
  IsIn,
} from 'class-validator';

export class CreateUserDto {
  @IsString({ message: 'O nome deve ser um texto válido.' })
  @IsNotEmpty({ message: 'O nome é obrigatório.' })
  nome!: string;

  @IsEmail({}, { message: 'O e-mail informado é inválido.' })
  @IsNotEmpty({ message: 'O e-mail é obrigatório.' })
  email!: string;

  @IsNotEmpty({ message: 'A senha é obrigatória.' })
  @IsString()
  @MinLength(8, { message: 'A senha deve ter no mínimo 8 caracteres.' })
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'A senha é muito fraca. Ela deve conter letras maiúsculas, números e caracteres especiais.',
  })
  password!: string;

  // CA4
  @Equals(true, {
    message: 'Você precisa aceitar os termos de uso para criar uma conta.',
  })
  termosAceitos!: boolean;

  @IsString()
  @IsNotEmpty({ message: 'O perfil da conta é obrigatório.' })
  @IsIn(['CLIENTE', 'PROFISSIONAL', 'ESTABELECIMENTO'], {
    message: 'O perfil informado é inválido.',
  })
  accountType!: string;
}
