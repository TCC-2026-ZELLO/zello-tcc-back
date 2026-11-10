import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { DASHBOARD_TOKENS } from './constants/dashboard.tokens';

describe('DashboardService', () => {
  let service: DashboardService;

  const revenueRepository = { findBreakdown: jest.fn(), findTotal: jest.fn() };
  const teamRepository = { findPerformance: jest.fn() };
  const visibilityRepository = { findFunnel: jest.fn() };
  const noShowsRepository = { findSummary: jest.fn() };

  const BUSINESS_ID = 'b1';

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: DASHBOARD_TOKENS.revenueRepository,
          useValue: revenueRepository,
        },
        { provide: DASHBOARD_TOKENS.teamRepository, useValue: teamRepository },
        {
          provide: DASHBOARD_TOKENS.visibilityRepository,
          useValue: visibilityRepository,
        },
        {
          provide: DASHBOARD_TOKENS.noShowsRepository,
          useValue: noShowsRepository,
        },
      ],
    }).compile();

    service = module.get(DashboardService);
  });

  function mockEmpty() {
    revenueRepository.findBreakdown.mockResolvedValue([]);
    revenueRepository.findTotal.mockResolvedValue({
      completed_count: 0,
      revenue: '0',
    });
    teamRepository.findPerformance.mockResolvedValue([]);
    visibilityRepository.findFunnel.mockResolvedValue({
      views: 0,
      appointments: 0,
    });
    noShowsRepository.findSummary.mockResolvedValue({
      no_show_count: 0,
      unjustified_cancellation_count: 0,
      lost_revenue: '0',
    });
  }

  it('consulta período atual e anterior nos repositories', async () => {
    mockEmpty();

    await service.getBusinessDashboard(BUSINESS_ID, {
      from: '2026-10-01',
      to: '2026-10-31',
    });

    expect(revenueRepository.findBreakdown).toHaveBeenCalledWith(
      BUSINESS_ID,
      '2026-10-01',
      '2026-10-31',
    );
    expect(revenueRepository.findTotal).toHaveBeenCalledWith(
      BUSINESS_ID,
      '2026-08-31',
      '2026-09-30',
    );
    expect(teamRepository.findPerformance).toHaveBeenCalledWith(
      BUSINESS_ID,
      '2026-10-01',
      '2026-10-31',
    );
    expect(visibilityRepository.findFunnel).toHaveBeenCalledWith(
      BUSINESS_ID,
      '2026-10-01',
      '2026-10-31',
    );
    expect(noShowsRepository.findSummary).toHaveBeenCalledWith(
      BUSINESS_ID,
      '2026-10-01',
      '2026-10-31',
    );
  });

  it('monta o contrato completo a partir das rows agregadas', async () => {
    revenueRepository.findBreakdown.mockResolvedValue([
      {
        service_id: 's1',
        service_name: 'Corte',
        date: '2026-10-01',
        appointments_count: 2,
        revenue: '100.00',
      },
      {
        service_id: 's2',
        service_name: 'Barba',
        date: '2026-10-01',
        appointments_count: 1,
        revenue: '50.00',
      },
      {
        service_id: 's1',
        service_name: 'Corte',
        date: '2026-10-03',
        appointments_count: 1,
        revenue: '50.00',
      },
    ]);
    revenueRepository.findTotal.mockResolvedValue({
      completed_count: 3,
      revenue: '160.00',
    });
    teamRepository.findPerformance.mockResolvedValue([
      {
        professional_id: 'p1',
        name: 'Ana',
        appointments_count: 4,
        revenue: '200.00',
      },
      {
        professional_id: 'p2',
        name: 'Bruno',
        appointments_count: 0,
        revenue: '0',
      },
    ]);
    visibilityRepository.findFunnel.mockResolvedValue({
      views: 40,
      appointments: 6,
    });
    noShowsRepository.findSummary.mockResolvedValue({
      no_show_count: 1,
      unjustified_cancellation_count: 1,
      lost_revenue: '50.00',
    });

    const result = await service.getBusinessDashboard(BUSINESS_ID, {
      from: '2026-10-01',
      to: '2026-10-03',
    });

    expect(result.period).toEqual({
      from: '2026-10-01',
      to: '2026-10-03',
      previousFrom: '2026-09-28',
      previousTo: '2026-09-30',
    });
    expect(result.revenue).toEqual({
      total: 200,
      previousTotal: 160,
      variationPercent: 25,
      completedCount: 4,
      averageTicket: 50,
      byService: [
        {
          serviceId: 's1',
          serviceName: 'Corte',
          revenue: 150,
          appointmentsCount: 3,
          sharePercent: 75,
        },
        {
          serviceId: 's2',
          serviceName: 'Barba',
          revenue: 50,
          appointmentsCount: 1,
          sharePercent: 25,
        },
      ],
      timeline: [
        { date: '2026-10-01', revenue: 150 },
        { date: '2026-10-02', revenue: 0 },
        { date: '2026-10-03', revenue: 50 },
      ],
    });
    expect(result.team).toEqual([
      { professionalId: 'p1', name: 'Ana', appointmentsCount: 4, revenue: 200 },
      { professionalId: 'p2', name: 'Bruno', appointmentsCount: 0, revenue: 0 },
    ]);
    expect(result.visibility).toEqual({
      views: 40,
      appointments: 6,
      conversionRate: 15,
    });
    expect(result.noShows).toEqual({
      noShowCount: 1,
      unjustifiedCancellationCount: 1,
      lostRevenue: 50,
      lostRevenuePercentOfPotential: 20,
    });
  });

  it('retorna zeros e nulls para período sem dados', async () => {
    mockEmpty();

    const result = await service.getBusinessDashboard(BUSINESS_ID, {
      from: '2026-10-01',
      to: '2026-10-02',
    });

    expect(result.revenue).toMatchObject({
      total: 0,
      previousTotal: 0,
      variationPercent: null,
      completedCount: 0,
      averageTicket: 0,
      byService: [],
      timeline: [
        { date: '2026-10-01', revenue: 0 },
        { date: '2026-10-02', revenue: 0 },
      ],
    });
    expect(result.visibility.conversionRate).toBeNull();
    expect(result.noShows.lostRevenuePercentOfPotential).toBeNull();
    expect(result.team).toEqual([]);
  });
});
