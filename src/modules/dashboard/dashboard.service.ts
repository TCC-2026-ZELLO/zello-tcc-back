import { Inject, Injectable } from '@nestjs/common';
import { DASHBOARD_TOKENS } from './constants/dashboard.tokens';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { DashboardResponseDto } from './dto/dashboard-response.dto';
import { listDays, resolvePeriod } from './helpers/period.helper';
import type {
  INoShowsRepository,
  IRevenueRepository,
  ITeamRepository,
  IVisibilityRepository,
} from './interfaces/dashboard-repositories.interface';
import {
  toNoShowSummary,
  toRevenueSummary,
  toTeamPerformance,
  toVisibilityFunnel,
} from './mappers/dashboard.mapper';

/**
 * Orquestra os dashboards de faturamento do estabelecimento (RF30).
 *
 * Dispara as consultas agregadas em paralelo e delega a conversão das rows ao
 * DashboardMapper. A posse do estabelecimento é validada antes, pelo
 * ManagesBusinessGuard.
 */
@Injectable()
export class DashboardService {
  constructor(
    @Inject(DASHBOARD_TOKENS.revenueRepository)
    private readonly revenueRepository: IRevenueRepository,
    @Inject(DASHBOARD_TOKENS.teamRepository)
    private readonly teamRepository: ITeamRepository,
    @Inject(DASHBOARD_TOKENS.visibilityRepository)
    private readonly visibilityRepository: IVisibilityRepository,
    @Inject(DASHBOARD_TOKENS.noShowsRepository)
    private readonly noShowsRepository: INoShowsRepository,
  ) {}

  async getBusinessDashboard(
    businessId: string,
    query: DashboardQueryDto,
  ): Promise<DashboardResponseDto> {
    const period = resolvePeriod(query.from, query.to);
    const { from, to, previousFrom, previousTo } = period;

    const [breakdown, previousTotal, team, funnel, noShows] = await Promise.all(
      [
        this.revenueRepository.findBreakdown(businessId, from, to),
        this.revenueRepository.findTotal(businessId, previousFrom, previousTo),
        this.teamRepository.findPerformance(businessId, from, to),
        this.visibilityRepository.findFunnel(businessId, from, to),
        this.noShowsRepository.findSummary(businessId, from, to),
      ],
    );

    const revenue = toRevenueSummary(
      breakdown,
      previousTotal,
      listDays(from, to),
    );

    return {
      period,
      revenue,
      team: toTeamPerformance(team),
      visibility: toVisibilityFunnel(funnel),
      noShows: toNoShowSummary(noShows, revenue.total),
    };
  }
}
