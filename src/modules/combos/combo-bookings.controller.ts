import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { ComboBookingsService } from './combo-bookings.service';
import {
  CreateComboBookingDto,
  RejectComboBookingDto,
} from './dto/combo-booking.dto';
import * as appointmentGroupEntity from './entities/appointment-group.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { SucessInterceptor } from '../../common/interceptors/success-interceptor';

@ApiTags('combo-bookings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(SucessInterceptor)
@Controller('combo-bookings')
export class ComboBookingsController {
  constructor(private readonly bookings: ComboBookingsService) {}

  @Post('combo/:comboId')
  @ApiOperation({
    summary: 'Solicitar a reserva de um combo',
    description:
      'Cria um grupo de agendamentos encadeados (AppointmentGroup) para todas as etapas do combo na data e horário escolhidos pelo cliente, aguardando aprovação do gestor.',
  })
  @ApiParam({
    name: 'comboId',
    description: 'UUID do combo desejado',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @ApiBody({ type: CreateComboBookingDto })
  @ApiResponse({
    status: 201,
    description: 'Reserva de combo solicitada com sucesso.',
  })
  async request(
    @Request() req: { user: ActiveUser },
    @Param('comboId', ParseUUIDPipe) comboId: string,
    @Body() dto: CreateComboBookingDto,
  ) {
    const group = await this.bookings.request(comboId, req.user.id, dto);
    return {
      message: 'Pedido enviado e aguarda aprovação',
      data: group,
    };
  }

  @Get('me')
  @ApiOperation({
    summary: 'Solicitações de combo do cliente logado',
    description:
      'Lista todas as reservas de combos solicitadas pelo cliente autenticado, detalhando os agendamentos sequenciais e seus respectivos status.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de reservas de combo do cliente retornada com sucesso.',
  })
  findMy(@Request() req: { user: ActiveUser }) {
    return this.bookings.findMyBookings(req.user.id);
  }

  @Get('business/:businessId')
  @ApiOperation({
    summary: 'Fila de solicitações de combo da empresa (Gestor)',
    description:
      'Retorna todas as solicitações de reserva de combos recebidas pelo estabelecimento, permitindo filtrar opcionalmente pelo status do grupo.',
  })
  @ApiParam({
    name: 'businessId',
    description: 'UUID do estabelecimento',
    example: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filtro opcional de status do grupo de agendamento',
    example: 'PENDING',
  })
  @ApiResponse({
    status: 200,
    description: 'Fila de solicitações de combo retornada com sucesso.',
  })
  findByBusiness(
    @Request() req: { user: ActiveUser },
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query('status') status?: appointmentGroupEntity.AppointmentGroupStatus,
  ) {
    return this.bookings.findByBusiness(businessId, req.user.id, status);
  }

  @Patch(':id/approve')
  @ApiOperation({
    summary: 'Aprovar o combo e bloquear a agenda de todos os profissionais',
    description:
      'Confirma de forma atômica todos os agendamentos integrantes do combo, bloqueando simultaneamente os horários nas agendas de todos os profissionais alocados.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID da solicitação de combo (AppointmentGroup)',
    example: 'a1b2c3d4-e5f6-4789-8012-34567890abcd',
  })
  @ApiResponse({
    status: 200,
    description: 'Combo aprovado e agendas bloqueadas com sucesso.',
  })
  async approve(
    @Request() req: { user: ActiveUser },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const group = await this.bookings.approve(id, req.user.id);
    return { message: 'Combo confirmado e agendas bloqueadas.', data: group };
  }

  @Patch(':id/reject')
  @ApiOperation({
    summary: 'Recusar o combo com justificativa (Gestor)',
    description:
      'Rejeita uma solicitação pendente de reserva de combo informando o motivo ao cliente e liberando os horários pré-reservados.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID da solicitação de combo (AppointmentGroup)',
    example: 'a1b2c3d4-e5f6-4789-8012-34567890abcd',
  })
  @ApiBody({ type: RejectComboBookingDto })
  @ApiResponse({
    status: 200,
    description: 'Solicitação de combo recusada com sucesso.',
  })
  async reject(
    @Request() req: { user: ActiveUser },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectComboBookingDto,
  ) {
    const group = await this.bookings.reject(id, req.user.id, dto);
    return {
      message: 'Solicitação recusada e cliente notificado.',
      data: group,
    };
  }

  @Patch(':id/cancel-justified')
  @ApiOperation({
    summary: 'Cancelar um combo confirmado (Gestor)',
    description:
      'Permite ao gestor cancelar um combo já confirmado mediante justificativa formal, liberando as agendas de todos os profissionais envolvidos.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID da solicitação de combo (AppointmentGroup)',
    example: 'a1b2c3d4-e5f6-4789-8012-34567890abcd',
  })
  @ApiBody({ type: RejectComboBookingDto })
  @ApiResponse({
    status: 200,
    description: 'Combo cancelado pelo gestor com sucesso.',
  })
  async cancelByManager(
    @Request() req: { user: ActiveUser },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectComboBookingDto,
  ) {
    const group = await this.bookings.cancelByManager(id, req.user.id, dto);
    return { message: 'Combo cancelado.', data: group };
  }

  @Patch(':id/cancel')
  @ApiOperation({
    summary: 'Cancelar a própria solicitação de combo (Cliente)',
    description:
      'Permite ao cliente cancelar sua própria reserva de combo, desbloqueando todos os horários vinculados.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID da solicitação de combo (AppointmentGroup)',
    example: 'a1b2c3d4-e5f6-4789-8012-34567890abcd',
  })
  @ApiResponse({
    status: 200,
    description: 'Solicitação de combo cancelada pelo cliente com sucesso.',
  })
  async cancel(
    @Request() req: { user: ActiveUser },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const group = await this.bookings.cancelByClient(id, req.user.id);
    return { message: 'Solicitação cancelada.', data: group };
  }
}
