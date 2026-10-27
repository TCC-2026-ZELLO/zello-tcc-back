import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  UseInterceptors,
  Patch,
  Param,
  Get,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto';
import {
  RescheduleAppointmentDto,
  RespondRescheduleDto,
} from './dto/reschedule-appointment.dto';
import { CancelJustifiedDto } from './dto/cancel-justified.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { SucessInterceptor } from '../../common/interceptors/success-interceptor';

@ApiTags('appointments')
@ApiBearerAuth()
@UseInterceptors(SucessInterceptor)
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Listar agendamentos do cliente logado',
    description:
      'Retorna o histórico e os próximos agendamentos pertencentes ao cliente autenticado, incluindo dados do estabelecimento, serviço, profissional e propostas de remarcação.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de agendamentos do cliente retornada com sucesso.',
  })
  async findMy(@Request() req: { user: ActiveUser }) {
    return this.appointmentsService.findByClient(req.user.id);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Listar agendamentos com filtros de data, empresa e profissional',
    description:
      'Permite filtrar agendamentos por uma data específica (date) ou intervalo de datas (dateFrom e dateTo), além de filtrar por estabelecimento (businessId) e profissional (professionalId).',
  })
  @ApiQuery({
    name: 'date',
    required: false,
    description: 'Data específica no formato YYYY-MM-DD',
    example: '2026-11-15',
  })
  @ApiQuery({
    name: 'dateFrom',
    required: false,
    description: 'Data inicial do período no formato YYYY-MM-DD',
    example: '2026-11-01',
  })
  @ApiQuery({
    name: 'dateTo',
    required: false,
    description: 'Data final do período no formato YYYY-MM-DD',
    example: '2026-11-30',
  })
  @ApiQuery({
    name: 'businessId',
    required: false,
    description: 'UUID do estabelecimento',
    example: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  })
  @ApiQuery({
    name: 'professionalId',
    required: false,
    description: 'UUID do profissional',
    example: '3b241101-e2bb-4255-8caf-4136c566a962',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista filtrada de agendamentos retornada com sucesso.',
  })
  async findAll(
    @Request() req: { user: ActiveUser },
    @Query('date') date?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('businessId') businessId?: string,
    @Query('professionalId') professionalId?: string,
  ) {
    return this.appointmentsService.findAll(req.user.id, {
      date,
      dateFrom,
      dateTo,
      businessId,
      professionalId,
    });
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Realizar um novo agendamento de serviço',
    description:
      'Cria uma nova solicitação de agendamento com status inicial PENDING, verificando disponibilidade de horário de funcionamento, turnos do profissional, tempo de limpeza (cleanupMinutes) e conflitos de agenda.',
  })
  @ApiBody({ type: CreateAppointmentDto })
  @ApiResponse({
    status: 201,
    description: 'Solicitação de agendamento criada com sucesso.',
    schema: {
      example: {
        message: 'Pedido enviado e aguarda aprovação',
        data: {
          id: 'c4a760a8-dbcf-4e14-9f39-6a8f1d2e3b4c',
          date: '2026-11-15',
          startTime: '14:30:00',
          endTime: '15:30:00',
          status: 'PENDING',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Horário indisponível ou dados inválidos.',
  })
  async create(
    @Request() req: { user: ActiveUser },
    @Body() dto: CreateAppointmentDto,
  ) {
    const appointment = await this.appointmentsService.create(dto, req.user.id);
    return {
      message: 'Pedido enviado e aguarda aprovação',
      data: appointment,
    };
  }

  @Patch(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Cancelar agendamento pelo próprio cliente',
    description:
      'Permite que o cliente autenticado cancele um agendamento próprio, liberando imediatamente o horário na agenda do profissional.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do agendamento',
    example: 'c4a760a8-dbcf-4e14-9f39-6a8f1d2e3b4c',
  })
  @ApiResponse({
    status: 200,
    description: 'Agendamento cancelado com sucesso.',
  })
  async cancel(
    @Request() req: { user: ActiveUser },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.appointmentsService.cancelClientAppointment(id, req.user.id);
    return { message: 'Agendamento cancelado com sucesso' };
  }

  @Patch(':id/reschedule')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Reagendar um atendimento (Cliente)',
    description:
      'Permite que o cliente solicite a remarcação de um agendamento para uma nova data e horário disponíveis.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do agendamento',
    example: 'c4a760a8-dbcf-4e14-9f39-6a8f1d2e3b4c',
  })
  @ApiBody({ type: RescheduleAppointmentDto })
  @ApiResponse({
    status: 200,
    description: 'Agendamento remarcado com sucesso.',
  })
  async reschedule(
    @Request() req: { user: ActiveUser },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RescheduleAppointmentDto,
  ) {
    const appointment = await this.appointmentsService.rescheduleByClient(
      id,
      req.user.id,
      dto,
    );
    return {
      message: 'Agendamento remarcado com sucesso',
      data: appointment,
    };
  }

  @Post(':id/reschedule-proposal')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Propor um novo horário ao cliente (Gestor)',
    description:
      'Permite que o gestor do estabelecimento envie uma proposta formal de nova data e horário para um agendamento existente, aguardando aceite ou recusa do cliente.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do agendamento',
    example: 'c4a760a8-dbcf-4e14-9f39-6a8f1d2e3b4c',
  })
  @ApiBody({ type: RescheduleAppointmentDto })
  @ApiResponse({
    status: 201,
    description: 'Proposta de novo horário enviada ao cliente.',
  })
  async proposeReschedule(
    @Request() req: { user: ActiveUser },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RescheduleAppointmentDto,
  ) {
    const appointment = await this.appointmentsService.proposeReschedule(
      id,
      req.user.id,
      dto,
    );
    return {
      message: 'Proposta enviada ao cliente',
      data: appointment,
    };
  }

  @Patch(':id/reschedule-proposal')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Aceitar ou recusar a proposta de novo horário (Cliente)',
    description:
      'Permite ao cliente responder à proposta de remarcação enviada pelo gestor. Se aceita (accept: true), o agendamento é atualizado para o novo horário.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do agendamento',
    example: 'c4a760a8-dbcf-4e14-9f39-6a8f1d2e3b4c',
  })
  @ApiBody({ type: RespondRescheduleDto })
  @ApiResponse({
    status: 200,
    description: 'Resposta à proposta registrada com sucesso.',
  })
  async respondToProposal(
    @Request() req: { user: ActiveUser },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RespondRescheduleDto,
  ) {
    const appointment = await this.appointmentsService.respondToProposal(
      id,
      req.user.id,
      dto.accept,
    );
    return {
      message: dto.accept ? 'Novo horário confirmado' : 'Proposta recusada',
      data: appointment,
    };
  }

  @Get('business/:businessId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Listar todos os agendamentos de um estabelecimento (Gestor)',
    description:
      'Retorna a fila completa de agendamentos de um estabelecimento específico para gerenciamento pelo gestor responsável.',
  })
  @ApiParam({
    name: 'businessId',
    description: 'UUID do estabelecimento',
    example: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de agendamentos da empresa retornada com sucesso.',
  })
  async findByBusiness(
    @Request() req: { user: ActiveUser },
    @Param('businessId', ParseUUIDPipe) businessId: string,
  ) {
    return this.appointmentsService.findByBusiness(businessId, req.user.id);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Atualizar status de um agendamento para CONFIRMED ou COMPLETED (Gestor)',
    description:
      'Permite ao gestor aprovar um agendamento pendente (CONFIRMED) ou concluir um atendimento já realizado (COMPLETED), atualizando também a sequência positiva (successStreak) do cliente.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do agendamento',
    example: 'c4a760a8-dbcf-4e14-9f39-6a8f1d2e3b4c',
  })
  @ApiBody({ type: UpdateAppointmentStatusDto })
  @ApiResponse({
    status: 200,
    description: 'Status do agendamento atualizado com sucesso.',
  })
  async updateStatus(
    @Request() req: { user: ActiveUser },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAppointmentStatusDto,
  ) {
    const appointment = await this.appointmentsService.updateStatus(
      id,
      dto.status,
      req.user.id,
    );
    return {
      message: `Status atualizado para ${dto.status}`,
      data: appointment,
    };
  }

  @Patch(':id/no-show')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Registrar falta injustificada (No-Show) de um cliente (Gestor)',
    description:
      'Marca o agendamento como NO_SHOW quando o cliente não comparece ao atendimento, incrementando o contador de faltas (noShowCount) e zerando o successStreak do cliente.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do agendamento',
    example: 'c4a760a8-dbcf-4e14-9f39-6a8f1d2e3b4c',
  })
  @ApiResponse({
    status: 200,
    description: 'No-Show registrado com sucesso.',
  })
  async markNoShow(
    @Request() req: { user: ActiveUser },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const appointment = await this.appointmentsService.markNoShow(
      id,
      req.user.id,
    );
    return {
      message: 'No-Show registrado com sucesso.',
      data: appointment,
    };
  }

  @Patch(':id/revert-no-show')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Reverter marcação de No-Show (Gestor)',
    description:
      'Desfaz a penalidade de No-Show aplicada anteriormente a um agendamento, restaurando os indicadores de reputação do cliente.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do agendamento',
    example: 'c4a760a8-dbcf-4e14-9f39-6a8f1d2e3b4c',
  })
  @ApiResponse({
    status: 200,
    description: 'No-Show revertido com sucesso.',
  })
  async revertNoShow(
    @Request() req: { user: ActiveUser },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const appointment = await this.appointmentsService.revertNoShow(
      id,
      req.user.id,
    );
    return {
      message: 'No-Show revertido com sucesso.',
      data: appointment,
    };
  }

  @Patch(':id/cancel-justified')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Cancelar agendamento com justificativa formal (Gestor)',
    description:
      'Permite ao gestor cancelar um agendamento informando o motivo e definindo se o cancelamento deve ou não impactar a reputação do cliente (affectsReputation).',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do agendamento',
    example: 'c4a760a8-dbcf-4e14-9f39-6a8f1d2e3b4c',
  })
  @ApiBody({ type: CancelJustifiedDto })
  @ApiResponse({
    status: 200,
    description: 'Cancelamento justificado efetuado com sucesso.',
  })
  async cancelJustified(
    @Request() req: { user: ActiveUser },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelJustifiedDto,
  ) {
    const appointment = await this.appointmentsService.cancelJustified(
      id,
      req.user.id,
      dto.reason,
      dto.affectsReputation || false,
    );
    return {
      message: 'Cancelamento efetuado com sucesso.',
      data: appointment,
    };
  }

  @Get('client/:clientId/reputation')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Consultar histórico de reputação e comparecimento de um cliente',
    description:
      'Retorna as métricas de confiabilidade do cliente (total de faltas No-Show, sequência atual de comparecimentos e alerta de risco) para auxiliar o gestor na aprovação de agendamentos.',
  })
  @ApiParam({
    name: 'clientId',
    description: 'UUID do perfil do cliente',
    example: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
  })
  @ApiResponse({
    status: 200,
    description: 'Indicadores de reputação do cliente retornados com sucesso.',
    schema: {
      example: {
        clientId: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
        noShowCount: 0,
        successStreak: 5,
      },
    },
  })
  async getClientReputation(
    @Param('clientId', ParseUUIDPipe) clientId: string,
  ) {
    return await this.appointmentsService.getClientReputation(clientId);
  }
}
