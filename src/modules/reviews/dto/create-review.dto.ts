import {
  IsEnum,
  IsInt,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ReviewTargetType } from '../entities/review.entity';

export class CreateReviewDto {
  @ApiProperty({
    description: 'UUID do agendamento concluído que está sendo avaliado',
    example: 'c4a760a8-dbcf-4e14-9f39-6a8f1d2e3b4c',
  })
  @IsString()
  appointmentId: string;

  @ApiProperty({
    description: 'Nota atribuída ao atendimento (1 a 5 estrelas)',
    example: 5,
    minimum: 1,
    maximum: 5,
  })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({
    description:
      'Comentário descritivo sobre a experiência do atendimento (10 a 1000 caracteres)',
    example:
      'Atendimento impecável! O corte ficou exatamente como eu pedi, o profissional foi super pontual e o ambiente é muito agradável.',
    minLength: 10,
    maxLength: 1000,
  })
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  comment: string;

  @ApiProperty({
    description:
      'Alvo da avaliação: PROFESSIONAL (avalia o especialista) ou BUSINESS (avalia o estabelecimento)',
    enum: ReviewTargetType,
    example: ReviewTargetType.PROFESSIONAL,
  })
  @IsEnum(ReviewTargetType)
  targetType: ReviewTargetType;
}
