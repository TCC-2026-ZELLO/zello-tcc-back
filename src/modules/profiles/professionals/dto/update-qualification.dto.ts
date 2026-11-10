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
import { ApiPropertyOptional } from '@nestjs/swagger';
import { QualificationType } from '../entities/qualification.entity';

export class UpdateQualificationDto {
  @ApiPropertyOptional({
    description: 'Título atualizado do curso, certificação ou formação',
    example: 'Masterclass Internacional de Mechas e Colorimetria',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({
    description: 'Instituição emissora atualizada',
    example: 'Wella Studio Brasil',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  institution?: string;

  @ApiPropertyOptional({
    description: 'Categoria da qualificação profissional',
    enum: QualificationType,
    example: QualificationType.CERTIFICATION,
  })
  @IsOptional()
  @IsEnum(QualificationType, {
    message: `type deve ser: ${Object.values(QualificationType).join(', ')}`,
  })
  type?: QualificationType;

  @ApiPropertyOptional({
    description: 'Ano de conclusão atualizado',
    example: 2025,
    minimum: 1900,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(new Date().getFullYear())
  year?: number;
}
