import { PartialType } from '@nestjs/swagger';
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
  @IsUUID()
  serviceId: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  sequence?: number = 0;
}

export class CreateComboDto {
  @IsString()
  @MinLength(3)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price: number;

  @IsArray()
  @ArrayMinSize(2, { message: 'Um combo precisa de pelo menos dois serviços.' })
  @ValidateNested({ each: true })
  @Type(() => ComboItemDto)
  items: ComboItemDto[];

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateComboDto extends PartialType(CreateComboDto) {}
