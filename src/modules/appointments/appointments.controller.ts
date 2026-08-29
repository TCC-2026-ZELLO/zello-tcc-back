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
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto';
import {
  RescheduleAppointmentDto,
  RespondRescheduleDto,
} from './dto/reschedule-appointment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SucessInterceptor } from '../../common/interceptors/success-interceptor';

@ApiTags('appointments')
@ApiBearerAuth()
@UseInterceptors(SucessInterceptor)
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Listar agendamentos do cliente logado' })
  async findMy(@Request() req: { user: ActiveUser }) {
    return this.appointmentsService.findByClient(req.user.id);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      'Listar agendamentos com filtros (date, businessId, professionalId)',
  })
  async findAll(
    @Request() req: { user: ActiveUser },
    @Query('date') date?: string,
    @Query('businessId') businessId?: string,
    @Query('professionalId') professionalId?: string,
  ) {
    return this.appointmentsService.findAll(req.user.id, {
      date,
      businessId,
      professionalId,
    });
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Realizar um novo agendamento' })
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
  @ApiOperation({ summary: 'Cancelar um agendamento pendente' })
  async cancel(
    @Request() req: { user: ActiveUser },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.appointmentsService.cancelClientAppointment(id, req.user.id);
    return { message: 'Agendamento cancelado com sucesso' };
  }

  @Patch(':id/reschedule')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Reagendar um atendimento (Cliente)' })
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
  @ApiOperation({ summary: 'Propor um novo horário ao cliente (Gestor)' })
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
  @ApiOperation({ summary: 'Listar agendamentos de uma empresa (Gestor)' })
  async findByBusiness(
    @Request() req: { user: ActiveUser },
    @Param('businessId', ParseUUIDPipe) businessId: string,
  ) {
    return this.appointmentsService.findByBusiness(businessId, req.user.id);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Atualizar status de um agendamento (Gestor)' })
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
}
