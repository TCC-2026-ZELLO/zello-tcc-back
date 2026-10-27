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
    example: 'Mariana Costa Silva',
  })
  @IsString({ message: 'O nome deve ser um texto válido.' })
  @IsNotEmpty({ message: 'O nome é obrigatório.' })
  nome!: string;

  @ApiProperty({
    description: 'E-mail único do usuário',
    example: 'mariana.costa@zello.com.br',
  })
  @IsEmail({}, { message: 'O e-mail informado é inválido.' })
  @IsNotEmpty({ message: 'O e-mail é obrigatório.' })
  email!: string;

  @ApiProperty({
    description:
      'Senha com no mínimo 8 caracteres (letras maiúsculas, minúsculas, números e caracteres especiais)',
    example: 'Zello@2026!',
    minLength: 8,
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

  @ApiProperty({
    description: 'Telefone celular com DDD (apenas dígitos)',
    example: '41998765432',
  })
  @IsString({ message: 'O telefone deve ser um texto válido.' })
  @IsNotEmpty({ message: 'O telefone é obrigatório.' })
  @Matches(/^\d{10,11}$/, { message: 'O telefone deve ter 10 ou 11 dígitos.' })
  phone!: string;

  @ApiProperty({
    description:
      'CPF válido com 11 dígitos (obrigatório para CLIENTE e PROFISSIONAL)',
    example: '39053344705',
    required: false,
  })
  @ValidateIf((o) => o.accountType !== 'ESTABELECIMENTO')
  @IsNotEmpty({ message: 'O CPF é obrigatório.' })
  @IsCpf()
  cpf?: string;

  @ApiProperty({
    description: 'Deseja receber lembretes de agendamento por E-mail?',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  wantsEmailReminders?: boolean;

  @ApiProperty({
    description: 'Deseja receber lembretes de agendamento por WhatsApp?',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  wantsWhatsappReminders?: boolean;

  // === Professional-specific fields ===
  @ApiProperty({
    description: 'Especialidade principal do profissional',
    example: 'Colorista e Visagista',
    required: false,
  })
  @ValidateIf((o) => o.accountType === 'PROFISSIONAL')
  @IsString()
  @IsNotEmpty({ message: 'A especialidade é obrigatória.' })
  specialty?: string;

  @ApiProperty({
    description: 'Biografia curta do profissional (máx. 280 caracteres)',
    example:
      'Especialista em mechas criativas, cortes terapêuticos e visagismo com 8 anos de atuação em Curitiba.',
    required: false,
  })
  @ValidateIf((o) => o.accountType === 'PROFISSIONAL')
  @IsOptional()
  @IsString()
  @MaxLength(280, { message: 'A biografia deve ter no máximo 280 caracteres.' })
  biography?: string;

  // === Establishment-specific fields ===
  @ApiProperty({
    description: 'CNPJ válido com 14 dígitos (obrigatório para ESTABELECIMENTO)',
    example: '11222333000181',
    required: false,
  })
  @ValidateIf((o) => o.accountType === 'ESTABELECIMENTO')
  @IsNotEmpty({ message: 'O CNPJ é obrigatório.' })
  @IsCnpj()
  cnpj?: string;

  @ApiProperty({
    description: 'Razão Social da empresa',
    example: 'Studio Belle Epoque Estetica e Beleza LTDA',
    required: false,
  })
  @ValidateIf((o) => o.accountType === 'ESTABELECIMENTO')
  @IsString()
  @IsNotEmpty({ message: 'A razão social é obrigatória.' })
  legalName?: string;

  @ApiProperty({
    description: 'Nome Fantasia do estabelecimento',
    example: 'Studio Belle Époque',
    required: false,
  })
  @ValidateIf((o) => o.accountType === 'ESTABELECIMENTO')
  @IsOptional()
  @IsString()
  tradeName?: string;

  @ApiProperty({
    description: 'Telefone comercial do estabelecimento',
    example: '4133224455',
    required: false,
  })
  @ValidateIf((o) => o.accountType === 'ESTABELECIMENTO')
  @IsOptional()
  @IsString()
  businessPhone?: string;

  // === Establishment address fields ===
  @ApiProperty({
    description: 'CEP do estabelecimento (apenas 8 dígitos)',
    example: '80020310',
    required: false,
  })
  @ValidateIf((o) => o.accountType === 'ESTABELECIMENTO')
  @IsNotEmpty({ message: 'O CEP é obrigatório.' })
  @Length(8, 8, { message: 'O CEP deve ter exatamente 8 dígitos.' })
  zipCode?: string;

  @ApiProperty({
    description: 'Logradouro do estabelecimento',
    example: 'Rua XV de Novembro',
    required: false,
  })
  @ValidateIf((o) => o.accountType === 'ESTABELECIMENTO')
  @IsString()
  @IsNotEmpty({ message: 'O logradouro é obrigatório.' })
  street?: string;

  @ApiProperty({
    description: 'Número do endereço do estabelecimento',
    example: '1299',
    required: false,
  })
  @ValidateIf((o) => o.accountType === 'ESTABELECIMENTO')
  @IsString()
  @IsNotEmpty({ message: 'O número é obrigatório.' })
  addressNumber?: string;

  @ApiProperty({
    description: 'Complemento do endereço do estabelecimento',
    example: 'Conjunto 402 - Edifício Centro Comercial',
    required: false,
  })
  @IsOptional()
  @IsString()
  complement?: string;

  @ApiProperty({
    description: 'Bairro do estabelecimento',
    example: 'Centro',
    required: false,
  })
  @ValidateIf((o) => o.accountType === 'ESTABELECIMENTO')
  @IsString()
  @IsNotEmpty({ message: 'O bairro é obrigatório.' })
  neighborhood?: string;

  @ApiProperty({
    description: 'Cidade do estabelecimento',
    example: 'Curitiba',
    required: false,
  })
  @ValidateIf((o) => o.accountType === 'ESTABELECIMENTO')
  @IsString()
  @IsNotEmpty({ message: 'A cidade é obrigatória.' })
  city?: string;

  @ApiProperty({
    description: 'UF do estabelecimento (2 caracteres)',
    example: 'PR',
    required: false,
  })
  @ValidateIf((o) => o.accountType === 'ESTABELECIMENTO')
  @IsString()
  @Length(2, 2, { message: 'O estado deve ter 2 caracteres.' })
  state?: string;

  // === Client optional address fields ===
  @ApiProperty({
    description: 'CEP residencial do cliente (8 dígitos)',
    example: '80420090',
    required: false,
  })
  @ValidateIf((o) => o.accountType === 'CLIENTE' && o.clientZipCode)
  @IsOptional()
  @Length(8, 8, { message: 'O CEP deve ter exatamente 8 dígitos.' })
  clientZipCode?: string;

  @ApiProperty({
    description: 'Logradouro residencial do cliente',
    example: 'Avenida do Batel',
    required: false,
  })
  @IsOptional()
  @IsString()
  clientStreet?: string;

  @ApiProperty({
    description: 'Número residencial do cliente',
    example: '1550',
    required: false,
  })
  @IsOptional()
  @IsString()
  clientNumber?: string;

  @ApiProperty({
    description: 'Complemento residencial do cliente',
    example: 'Apto 804',
    required: false,
  })
  @IsOptional()
  @IsString()
  clientComplement?: string;

  @ApiProperty({
    description: 'Bairro residencial do cliente',
    example: 'Batel',
    required: false,
  })
  @IsOptional()
  @IsString()
  clientNeighborhood?: string;

  @ApiProperty({
    description: 'Cidade residencial do cliente',
    example: 'Curitiba',
    required: false,
  })
  @IsOptional()
  @IsString()
  clientCity?: string;

  @ApiProperty({
    description: 'UF residencial do cliente (2 caracteres)',
    example: 'PR',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(2, 2, { message: 'O estado deve ter 2 caracteres.' })
  clientState?: string;
}
