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
  ParseUUIDPipe,
} from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto';
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
    const appointment = await this.appointmentsService.updateStatus(id, dto.status, req.user.id);
    return {
      message: `Status atualizado para ${dto.status}`,
      data: appointment,
    };
  }
}
