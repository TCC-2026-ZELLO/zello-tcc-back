import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CancelJustifiedDto {
  @ApiProperty({ description: 'O motivo do cancelamento' })
  @IsNotEmpty()
  @IsString()
  reason!: string;

  @ApiProperty({ description: 'Se o cancelamento afeta a reputação do cliente (ex: falta injustificada). False = Erro do local / Emergência do cliente.' })
  @IsOptional()
  @IsBoolean()
  affectsReputation?: boolean;
}
