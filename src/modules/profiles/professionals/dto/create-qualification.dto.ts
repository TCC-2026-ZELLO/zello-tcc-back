import {
  IsString,
  IsOptional,
  IsInt,
  IsEnum,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QualificationType } from '../entities/qualification.entity';

export class CreateQualificationDto {
  @ApiProperty({
    description: 'Título do curso, certificação ou formação acadêmica',
    example: 'Especialização em Visagismo e Colorimetria Avançada',
    maxLength: 200,
  })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({
    description: 'Instituição emissora do certificado ou diploma',
    example: 'Academia L’Oréal Professionnel São Paulo',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  institution?: string;

  @ApiPropertyOptional({
    description: 'Categoria da qualificação profissional',
    enum: QualificationType,
    example: QualificationType.SPECIALIZATION,
  })
  @IsOptional()
  @IsEnum(QualificationType, {
    message: `type deve ser: ${Object.values(QualificationType).join(', ')}`,
  })
  type?: QualificationType;

  @ApiPropertyOptional({
    description: 'Ano de conclusão da formação ou certificação',
    example: 2024,
    minimum: 1900,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(new Date().getFullYear())
  year?: number;
}
