import {
  IsEmail,
  IsNotEmpty,
  MinLength,
  Equals,
  IsString,
  Matches,
  IsIn,
  IsBoolean,
  ValidateIf,
  IsOptional,
  MaxLength,
  Length,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsCpf } from '../../../common/validators/is-cpf.validator';
import { IsCnpj } from '../../../common/validators/is-cnpj.validator';

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

  @ApiProperty({
    description: 'Aceite dos termos de uso — deve ser true para prosseguir',
    example: true,
  })
  @Transform(({ value }) => value === 'true' || value === true)
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

  @ApiProperty({ description: 'Telefone celular (apenas dígitos)', example: '11999998888' })
  @IsString({ message: 'O telefone deve ser um texto válido.' })
  @IsNotEmpty({ message: 'O telefone é obrigatório.' })
  @Matches(/^\d{10,11}$/, { message: 'O telefone deve ter 10 ou 11 dígitos.' })
  phone!: string;

  @ApiProperty({ description: 'CPF (apenas dígitos)', example: '12345678901', required: false })
  @ValidateIf((o) => o.accountType !== 'ESTABELECIMENTO')
  @IsNotEmpty({ message: 'O CPF é obrigatório.' })
  @IsCpf()
  cpf?: string;

  // === Professional-specific fields ===
  @ApiProperty({ description: 'Especialidade do profissional', example: 'Cabeleireiro', required: false })
  @ValidateIf((o) => o.accountType === 'PROFISSIONAL')
  @IsString()
  @IsNotEmpty({ message: 'A especialidade é obrigatória.' })
  specialty?: string;

  @ApiProperty({ description: 'Biografia curta', example: 'Profissional com 5 anos de experiência.', required: false })
  @ValidateIf((o) => o.accountType === 'PROFISSIONAL')
  @IsOptional()
  @IsString()
  @MaxLength(280, { message: 'A biografia deve ter no máximo 280 caracteres.' })
  biography?: string;

  // === Establishment-specific fields ===
  @ApiProperty({ description: 'CNPJ (apenas dígitos)', example: '11222333000181', required: false })
  @ValidateIf((o) => o.accountType === 'ESTABELECIMENTO')
  @IsNotEmpty({ message: 'O CNPJ é obrigatório.' })
  @IsCnpj()
  cnpj?: string;

  @ApiProperty({ description: 'Razão Social', example: 'Salão Beleza LTDA', required: false })
  @ValidateIf((o) => o.accountType === 'ESTABELECIMENTO')
  @IsString()
  @IsNotEmpty({ message: 'A razão social é obrigatória.' })
  legalName?: string;

  @ApiProperty({ description: 'Nome Fantasia', example: 'Salão Beleza', required: false })
  @ValidateIf((o) => o.accountType === 'ESTABELECIMENTO')
  @IsOptional()
  @IsString()
  tradeName?: string;

  @ApiProperty({ description: 'Telefone comercial', required: false })
  @ValidateIf((o) => o.accountType === 'ESTABELECIMENTO')
  @IsOptional()
  @IsString()
  businessPhone?: string;

  // === Establishment address fields ===
  @ApiProperty({ description: 'CEP (apenas dígitos)', example: '01001000', required: false })
  @ValidateIf((o) => o.accountType === 'ESTABELECIMENTO')
  @IsNotEmpty({ message: 'O CEP é obrigatório.' })
  @Length(8, 8, { message: 'O CEP deve ter exatamente 8 dígitos.' })
  zipCode?: string;

  @ApiProperty({ description: 'Logradouro', required: false })
  @ValidateIf((o) => o.accountType === 'ESTABELECIMENTO')
  @IsString()
  @IsNotEmpty({ message: 'O logradouro é obrigatório.' })
  street?: string;

  @ApiProperty({ description: 'Número', required: false })
  @ValidateIf((o) => o.accountType === 'ESTABELECIMENTO')
  @IsString()
  @IsNotEmpty({ message: 'O número é obrigatório.' })
  addressNumber?: string;

  @ApiProperty({ description: 'Complemento', required: false })
  @IsOptional()
  @IsString()
  complement?: string;

  @ApiProperty({ description: 'Bairro', required: false })
  @ValidateIf((o) => o.accountType === 'ESTABELECIMENTO')
  @IsString()
  @IsNotEmpty({ message: 'O bairro é obrigatório.' })
  neighborhood?: string;

  @ApiProperty({ description: 'Cidade', required: false })
  @ValidateIf((o) => o.accountType === 'ESTABELECIMENTO')
  @IsString()
  @IsNotEmpty({ message: 'A cidade é obrigatória.' })
  city?: string;

  @ApiProperty({ description: 'UF (2 caracteres)', required: false })
  @ValidateIf((o) => o.accountType === 'ESTABELECIMENTO')
  @IsString()
  @Length(2, 2, { message: 'O estado deve ter 2 caracteres.' })
  state?: string;

  // === Client optional address fields ===
  @ApiProperty({ description: 'CEP do cliente', required: false })
  @ValidateIf((o) => o.accountType === 'CLIENTE' && o.clientZipCode)
  @IsOptional()
  @Length(8, 8, { message: 'O CEP deve ter exatamente 8 dígitos.' })
  clientZipCode?: string;

  @ApiProperty({ description: 'Logradouro do cliente', required: false })
  @IsOptional()
  @IsString()
  clientStreet?: string;

  @ApiProperty({ description: 'Número do cliente', required: false })
  @IsOptional()
  @IsString()
  clientNumber?: string;

  @ApiProperty({ description: 'Complemento do cliente', required: false })
  @IsOptional()
  @IsString()
  clientComplement?: string;

  @ApiProperty({ description: 'Bairro do cliente', required: false })
  @IsOptional()
  @IsString()
  clientNeighborhood?: string;

  @ApiProperty({ description: 'Cidade do cliente', required: false })
  @IsOptional()
  @IsString()
  clientCity?: string;

  @ApiProperty({ description: 'UF do cliente', required: false })
  @IsOptional()
  @IsString()
  @Length(2, 2, { message: 'O estado deve ter 2 caracteres.' })
  clientState?: string;
}
