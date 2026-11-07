import {
  NoShowSummaryDto,
  RevenueByServiceDto,
  RevenueSummaryDto,
  TeamMemberPerformanceDto,
  VisibilityFunnelDto,
} from '../dto/dashboard-response.dto';
import {
  percentOf,
  round2,
  variationPercent,
} from '../helpers/variation.helper';
import {
  NoShowSummaryRow,
  RevenueBreakdownRow,
  RevenueTotalRow,
  TeamPerformanceRow,
  VisibilityFunnelRow,
} from '../interfaces/dashboard-rows.interface';

/**
 * Conversão pura das rows brutas dos repositories no contrato da API do
 * dashboard (RF30). Sem dependência de Nest — testável isoladamente.
 */

interface ServiceAccumulator {
  serviceName: string;
  revenue: number;
  appointmentsCount: number;
}

/** CA1 + CA4: receita global, por serviço, série diária e comparativo. */
export function toRevenueSummary(
  rows: RevenueBreakdownRow[],
  previous: RevenueTotalRow,
  days: string[],
): RevenueSummaryDto {
  const services = new Map<string, ServiceAccumulator>();
  const revenueByDay = new Map<string, number>();
  let total = 0;
  let completedCount = 0;

  for (const row of rows) {
    const revenue = Number(row.revenue);
    total += revenue;
    completedCount += row.appointments_count;

    const service = services.get(row.service_id) ?? {
      serviceName: row.service_name,
      revenue: 0,
      appointmentsCount: 0,
    };
    service.revenue += revenue;
    service.appointmentsCount += row.appointments_count;
    services.set(row.service_id, service);

    revenueByDay.set(row.date, (revenueByDay.get(row.date) ?? 0) + revenue);
  }

  const roundedTotal = round2(total);
  const previousTotal = round2(Number(previous.revenue));

  const byService: RevenueByServiceDto[] = [...services.entries()]
    .map(([serviceId, service]) => ({
      serviceId,
      serviceName: service.serviceName,
      revenue: round2(service.revenue),
      appointmentsCount: service.appointmentsCount,
      sharePercent: percentOf(service.revenue, total) ?? 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  return {
    total: roundedTotal,
    previousTotal,
    variationPercent: variationPercent(roundedTotal, previousTotal),
    completedCount,
    averageTicket: completedCount > 0 ? round2(total / completedCount) : 0,
    byService,
    timeline: days.map((date) => ({
      date,
      revenue: round2(revenueByDay.get(date) ?? 0),
    })),
  };
}

/** CA2: performance por profissional. */
export function toTeamPerformance(
  rows: TeamPerformanceRow[],
): TeamMemberPerformanceDto[] {
  return rows.map((row) => ({
    professionalId: row.professional_id,
    name: row.name,
    appointmentsCount: row.appointments_count,
    revenue: round2(Number(row.revenue)),
  }));
}

/** CA3: funil visualizações vs agendamentos. */
export function toVisibilityFunnel(
  row: VisibilityFunnelRow,
): VisibilityFunnelDto {
  return {
    views: row.views,
    appointments: row.appointments,
    conversionRate: percentOf(row.appointments, row.views),
  };
}

/** CA5: perda estimada, relativa ao potencial (realizado + perdido). */
export function toNoShowSummary(
  row: NoShowSummaryRow,
  realizedRevenue: number,
): NoShowSummaryDto {
  const lostRevenue = round2(Number(row.lost_revenue));
  return {
    noShowCount: row.no_show_count,
    unjustifiedCancellationCount: row.unjustified_cancellation_count,
    lostRevenue,
    lostRevenuePercentOfPotential: percentOf(
      lostRevenue,
      realizedRevenue + lostRevenue,
    ),
  };
}
