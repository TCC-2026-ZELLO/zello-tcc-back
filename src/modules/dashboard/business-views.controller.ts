import {
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { BusinessViewsService } from './business-views.service';

/**
 * Tracking de visualizações da página do estabelecimento (insumo do RF30 — CA3).
 * Mantido fora do BusinessesController para não acoplar o domínio de Business
 * ao dashboard.
 */
@ApiTags('businesses')
@ApiBearerAuth()
@Controller('businesses')
export class BusinessViewsController {
  constructor(private readonly businessViewsService: BusinessViewsService) {}

  @Post(':id/views')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Registrar visualização da página do estabelecimento',
    description:
      'Idempotente: conta no máximo 1 visualização por usuário, por estabelecimento, por dia (no timezone do negócio). Visualizações do próprio gestor do estabelecimento são ignoradas.',
  })
  @ApiParam({ name: 'id', description: 'ID (UUID) do estabelecimento.' })
  @ApiResponse({ status: 204, description: 'Visualização registrada.' })
  @ApiResponse({ status: 400, description: 'ID inválido.' })
  @ApiResponse({ status: 401, description: 'Não autenticado.' })
  @ApiResponse({ status: 404, description: 'Estabelecimento não encontrado.' })
  async registerView(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: ActiveUser },
  ): Promise<void> {
    await this.businessViewsService.registerView(id, req.user.id);
  }
}
