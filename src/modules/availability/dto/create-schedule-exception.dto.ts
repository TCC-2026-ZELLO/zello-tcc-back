import { IsString, IsOptional, IsUUID, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateScheduleExceptionDto {
  @ApiPropertyOptional({
    description: 'Data única do bloqueio/exceção no formato YYYY-MM-DD',
    example: '2026-11-02',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Data deve ser YYYY-MM-DD' })
  date?: string;

  @ApiPropertyOptional({
    description:
      'Lista de datas para bloqueio em lote (ex.: período de férias) no formato YYYY-MM-DD',
    example: ['2026-12-24', '2026-12-25'],
    type: [String],
  })
  @IsOptional()
  @IsString({ each: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    each: true,
    message: 'Datas devem ser YYYY-MM-DD',
  })
  dates?: string[];

  @ApiPropertyOptional({
    description:
      'Horário inicial do bloqueio parcial (HH:mm:ss). Se omitido junto com endTime, bloqueia o dia inteiro.',
    example: '12:00:00',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/)
  startTime?: string;

  @ApiPropertyOptional({
    description:
      'Horário final do bloqueio parcial (HH:mm:ss). Se omitido junto com startTime, bloqueia o dia inteiro.',
    example: '14:00:00',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/)
  endTime?: string;

  @ApiProperty({
    description: 'Motivo da exceção ou bloqueio de agenda',
    example: 'Feriado Nacional de Finados / Recesso da Equipe',
  })
  @IsString()
  reason: string;

  @ApiPropertyOptional({
    description: 'UUID do estabelecimento (para bloqueio geral da empresa)',
    example: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  })
  @IsOptional()
  @IsString()
  businessId?: string;

  @ApiPropertyOptional({
    description:
      'UUID do profissional (para folga/ausência específica de um profissional)',
    example: '3b241101-e2bb-4255-8caf-4136c566a962',
  })
  @IsOptional()
  @IsString()
  professionalId?: string;

  @ApiPropertyOptional({
    description:
      'Se true, ignora datas da lista que possuam agendamentos confirmados conflitantes',
    example: false,
  })
  @IsOptional()
  skipConflicts?: boolean;

  @ApiPropertyOptional({
    description:
      'Se true, cancela automaticamente solicitações pendentes no período bloqueado',
    example: false,
  })
  @IsOptional()
  forceOverwritePending?: boolean;
}
