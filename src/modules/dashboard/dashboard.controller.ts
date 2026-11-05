import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { SucessInterceptor } from '../../common/interceptors/success-interceptor';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DashboardService } from './dashboard.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { DashboardResponseDto } from './dto/dashboard-response.dto';
import { ManagesBusinessGuard } from './guards/manages-business.guard';

/**
 * RF30 — Dashboards de faturamento do estabelecimento.
 */
@ApiTags('dashboard')
@ApiBearerAuth()
@UseInterceptors(SucessInterceptor)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('businesses/:businessId')
  @UseGuards(JwtAuthGuard, RolesGuard, ManagesBusinessGuard)
  @Roles('manager')
  @ApiOperation({
    summary: 'Dashboard de faturamento do estabelecimento',
    description:
      'Retorna, para o período selecionado (from/to inclusivos): faturamento global e por serviço com série diária, comparativo com o período anterior de mesma duração, performance da equipe, funil de visualizações vs agendamentos e perda estimada com no-shows e cancelamentos não justificados. A receita é estimada a partir do preço atual do serviço (com desconto proporcional em combos).',
  })
  @ApiParam({
    name: 'businessId',
    description: 'ID (UUID) do estabelecimento gerenciado pelo gestor.',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard calculado com sucesso (campo data).',
    type: DashboardResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Período inválido (formato, data final anterior à inicial ou intervalo acima do máximo) ou ID inválido.',
  })
  @ApiResponse({ status: 401, description: 'Não autenticado.' })
  @ApiResponse({
    status: 403,
    description: 'Usuário não é gestor deste estabelecimento.',
  })
  async getBusinessDashboard(
    @Param('businessId') businessId: string,
    @Query() query: DashboardQueryDto,
  ): Promise<DashboardResponseDto> {
    return this.dashboardService.getBusinessDashboard(businessId, query);
  }
}
