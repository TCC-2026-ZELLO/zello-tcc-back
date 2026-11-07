import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment } from '../appointments/entities/appointment.entity';
import { BusinessManager } from '../business-managers/entities/business-manager.entity';
import { Manager } from '../profiles/managers/entities/manager.entity';
import { BusinessViewsController } from './business-views.controller';
import { BusinessViewsService } from './business-views.service';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DASHBOARD_TOKENS } from './constants/dashboard.tokens';
import { BusinessView } from './entities/business-view.entity';
import { ManagesBusinessGuard } from './guards/manages-business.guard';
import { BusinessViewRepository } from './repositories/business-view.repository';
import { NoShowsRepository } from './repositories/no-shows.repository';
import { RevenueRepository } from './repositories/revenue.repository';
import { TeamRepository } from './repositories/team.repository';
import { VisibilityRepository } from './repositories/visibility.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BusinessView,
      Appointment,
      Manager,
      BusinessManager,
    ]),
  ],
  controllers: [DashboardController, BusinessViewsController],
  providers: [
    DashboardService,
    BusinessViewsService,
    ManagesBusinessGuard,
    {
      provide: DASHBOARD_TOKENS.revenueRepository,
      useClass: RevenueRepository,
    },
    { provide: DASHBOARD_TOKENS.teamRepository, useClass: TeamRepository },
    {
      provide: DASHBOARD_TOKENS.noShowsRepository,
      useClass: NoShowsRepository,
    },
    {
      provide: DASHBOARD_TOKENS.visibilityRepository,
      useClass: VisibilityRepository,
    },
    {
      provide: DASHBOARD_TOKENS.businessViewRepository,
      useClass: BusinessViewRepository,
    },
  ],
})
export class DashboardModule {}
