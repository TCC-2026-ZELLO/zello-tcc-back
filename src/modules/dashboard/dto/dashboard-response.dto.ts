import { ApiProperty } from '@nestjs/swagger';

export class DashboardPeriodDto {
  @ApiProperty({ example: '2026-10-01' })
  from: string;

  @ApiProperty({ example: '2026-10-31' })
  to: string;

  @ApiProperty({
    example: '2026-08-31',
    description: 'Início do período anterior (mesma duração).',
  })
  previousFrom: string;

  @ApiProperty({
    example: '2026-09-30',
    description: 'Fim do período anterior (dia anterior a "from").',
  })
  previousTo: string;
}

export class RevenueByServiceDto {
  @ApiProperty({ format: 'uuid' })
  serviceId: string;

  @ApiProperty({ example: 'Corte masculino' })
  serviceName: string;

  @ApiProperty({ example: 1250.5, description: 'Receita estimada (R$).' })
  revenue: number;

  @ApiProperty({ example: 25 })
  appointmentsCount: number;

  @ApiProperty({
    example: 42.3,
    description: 'Participação (%) do serviço na receita do período.',
  })
  sharePercent: number;
}

export class RevenueTimelinePointDto {
  @ApiProperty({ example: '2026-10-01' })
  date: string;

  @ApiProperty({ example: 320 })
  revenue: number;
}

export class RevenueSummaryDto {
  @ApiProperty({
    example: 2956.4,
    description: 'Receita estimada no período (R$).',
  })
  total: number;

  @ApiProperty({
    example: 2500,
    description: 'Receita estimada no período anterior (R$).',
  })
  previousTotal: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 18.26,
    description:
      'Variação (%) vs período anterior. null quando o período anterior não tem receita (sem base de comparação).',
  })
  variationPercent: number | null;

  @ApiProperty({ example: 60 })
  completedCount: number;

  @ApiProperty({ example: 49.27, description: 'Ticket médio (R$).' })
  averageTicket: number;

  @ApiProperty({ type: [RevenueByServiceDto] })
  byService: RevenueByServiceDto[];

  @ApiProperty({
    type: [RevenueTimelinePointDto],
    description: 'Um ponto por dia do período, com zeros nos dias sem receita.',
  })
  timeline: RevenueTimelinePointDto[];
}

export class TeamMemberPerformanceDto {
  @ApiProperty({ format: 'uuid' })
  professionalId: string;

  @ApiProperty({ example: 'Maria Souza' })
  name: string;

  @ApiProperty({ example: 18, description: 'Atendimentos concluídos.' })
  appointmentsCount: number;

  @ApiProperty({ example: 980, description: 'Receita estimada (R$).' })
  revenue: number;
}

export class VisibilityFunnelDto {
  @ApiProperty({
    example: 340,
    description: 'Visualizações da página no período.',
  })
  views: number;

  @ApiProperty({ example: 51, description: 'Agendamentos criados no período.' })
  appointments: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 15,
    description:
      'appointments / views * 100. null quando não há visualizações.',
  })
  conversionRate: number | null;
}

export class NoShowSummaryDto {
  @ApiProperty({ example: 4 })
  noShowCount: number;

  @ApiProperty({
    example: 3,
    description: 'Cancelamentos não justificados (cliente ou gestor).',
  })
  unjustifiedCancellationCount: number;

  @ApiProperty({ example: 310, description: 'Receita perdida estimada (R$).' })
  lostRevenue: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 9.49,
    description:
      'lostRevenue / (receita do período + lostRevenue) * 100. null quando ambos são 0.',
  })
  lostRevenuePercentOfPotential: number | null;
}

export class DashboardResponseDto {
  @ApiProperty({ type: DashboardPeriodDto })
  period: DashboardPeriodDto;

  @ApiProperty({ type: RevenueSummaryDto })
  revenue: RevenueSummaryDto;

  @ApiProperty({ type: [TeamMemberPerformanceDto] })
  team: TeamMemberPerformanceDto[];

  @ApiProperty({ type: VisibilityFunnelDto })
  visibility: VisibilityFunnelDto;

  @ApiProperty({ type: NoShowSummaryDto })
  noShows: NoShowSummaryDto;
}
