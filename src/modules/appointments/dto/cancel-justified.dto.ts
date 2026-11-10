import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CancelJustifiedDto {
  @ApiProperty({
    description: 'Justificativa detalhada do cancelamento pelo gestor',
    example:
      'Profissional precisou se ausentar por emergência médica. Oferecemos remarcação prioritária.',
  })
  @IsNotEmpty()
  @IsString()
  reason!: string;

  @ApiPropertyOptional({
    description:
      'Indica se o cancelamento penaliza a reputação do cliente (ex.: falta injustificada). False = imprevisto do estabelecimento ou emergência justificada.',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  affectsReputation?: boolean;
}
