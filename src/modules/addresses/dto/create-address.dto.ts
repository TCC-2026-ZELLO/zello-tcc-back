import { IsLatitude, IsLongitude, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAddressDto {
  @ApiProperty({ description: 'CEP (apenas dígitos)', example: '01001000' })
  @IsString()
  @IsNotEmpty({ message: 'O CEP é obrigatório.' })
  @Length(8, 8, { message: 'O CEP deve ter exatamente 8 dígitos.' })
  zipCode!: string;

  @ApiProperty({ description: 'Logradouro', example: 'Praça da Sé' })
  @IsString()
  @IsNotEmpty({ message: 'O logradouro é obrigatório.' })
  street!: string;

  @ApiProperty({ description: 'Número', example: '1' })
  @IsString()
  @IsNotEmpty({ message: 'O número é obrigatório.' })
  number!: string;

  @ApiProperty({ description: 'Complemento', example: 'Sala 101', required: false })
  @IsOptional()
  @IsString()
  complement?: string;

  @ApiProperty({ description: 'Bairro', example: 'Sé' })
  @IsString()
  @IsNotEmpty({ message: 'O bairro é obrigatório.' })
  neighborhood!: string;

  @ApiProperty({ description: 'Cidade', example: 'São Paulo' })
  @IsString()
  @IsNotEmpty({ message: 'A cidade é obrigatória.' })
  city!: string;

  @ApiProperty({ description: 'UF (2 caracteres)', example: 'SP' })
  @IsString()
  @Length(2, 2, { message: 'O estado deve ter 2 caracteres.' })
  state!: string;

  @ApiProperty({
    description:
      'Latitude geocodificada do endereço (necessária para aparecer na busca por geolocalização).',
    example: -25.4284,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude({ message: 'A latitude informada é inválida.' })
  latitude?: number;

  @ApiProperty({
    description:
      'Longitude geocodificada do endereço (necessária para aparecer na busca por geolocalização).',
    example: -49.2733,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude({ message: 'A longitude informada é inválida.' })
  longitude?: number;
}
