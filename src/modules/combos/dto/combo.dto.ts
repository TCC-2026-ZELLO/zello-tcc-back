import {
  PartialType,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ComboItemDto {
  @ApiProperty({
    description: 'UUID do serviço integrante do combo',
    example: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  })
  @IsUUID()
  serviceId: string;

  @ApiPropertyOptional({
    description:
      'Ordem de execução do serviço dentro do combo (0 = primeiro serviço, 1 = segundo serviço, etc.)',
    example: 0,
    minimum: 0,
    maximum: 20,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  sequence?: number = 0;
}

export class CreateComboDto {
  @ApiProperty({
    description: 'Nome comercial do pacote promocional (combo)',
    example: 'Pacote Noivo Premium: Corte + Barba Terapia + Limpeza de Pele',
    minLength: 3,
  })
  @IsString()
  @MinLength(3)
  name: string;

  @ApiPropertyOptional({
    description: 'Descrição detalhada dos benefícios e serviços do combo',
    example:
      'Combo completo de preparação com desconto especial, executado em sequência sincronizada pelos nossos especialistas.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Preço promocional total do combo em Reais (BRL)',
    example: 149.9,
    minimum: 0,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price: number;

  @ApiProperty({
    description:
      'Lista de serviços que compõem o combo (mínimo de 2 serviços)',
    type: [ComboItemDto],
    example: [
      {
        serviceId: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
        sequence: 0,
      },
      {
        serviceId: '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed',
        sequence: 1,
      },
    ],
  })
  @IsArray()
  @ArrayMinSize(2, { message: 'Um combo precisa de pelo menos dois serviços.' })
  @ValidateNested({ each: true })
  @Type(() => ComboItemDto)
  items: ComboItemDto[];

  @ApiPropertyOptional({
    description: 'Define se o combo está ativo para reservas pelos clientes',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateComboDto extends PartialType(CreateComboDto) {}
