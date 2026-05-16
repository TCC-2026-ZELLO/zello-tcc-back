import { IsNotEmpty, IsString, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBusinessDto {
  @ApiProperty({ example: 'Clínica Saúde & Cia' })
  @IsNotEmpty({ message: 'O nome fantasia (tradeName) é obrigatório.' })
  @IsString()
  tradeName: string;

  @ApiProperty({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  defaulting?: boolean;

  @IsOptional()
  @IsBoolean()
  visibilityStatus?: boolean;
}
