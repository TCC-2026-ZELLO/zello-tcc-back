
export interface RevenueBreakdownRow {
  service_id: string;
  service_name: string;
  date: string;
  appointments_count: number;
  revenue: string;
}

export interface RevenueTotalRow {
  completed_count: number;
  revenue: string;
}

export interface TeamPerformanceRow {
  professional_id: string;
  name: string;
  appointments_count: number;
  revenue: string;
}

export interface NoShowSummaryRow {
  no_show_count: number;
  unjustified_cancellation_count: number;
  lost_revenue: string;
}

export interface VisibilityFunnelRow {
  views: number;
  appointments: number;
}
