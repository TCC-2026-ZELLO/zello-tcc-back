import {
  NoShowSummaryRow,
  RevenueBreakdownRow,
  RevenueTotalRow,
  TeamPerformanceRow,
  VisibilityFunnelRow,
} from './dashboard-rows.interface';

export interface IRevenueRepository {
  findBreakdown(
    businessId: string,
    from: string,
    to: string,
  ): Promise<RevenueBreakdownRow[]>;
  findTotal(
    businessId: string,
    from: string,
    to: string,
  ): Promise<RevenueTotalRow>;
}

export interface ITeamRepository {
  findPerformance(
    businessId: string,
    from: string,
    to: string,
  ): Promise<TeamPerformanceRow[]>;
}

export interface INoShowsRepository {
  findSummary(
    businessId: string,
    from: string,
    to: string,
  ): Promise<NoShowSummaryRow>;
}

export interface IVisibilityRepository {
  findFunnel(
    businessId: string,
    from: string,
    to: string,
  ): Promise<VisibilityFunnelRow>;
}

export interface IBusinessViewRepository {
  businessExists(businessId: string): Promise<boolean>;
  registerView(businessId: string, viewerId: string): Promise<boolean>;
}
