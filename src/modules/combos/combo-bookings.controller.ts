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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

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
  @ApiOperation({ summary: 'Solicitar a reserva de um combo' })
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
  @ApiOperation({ summary: 'Solicitações de combo do cliente logado' })
  findMy(@Request() req: { user: ActiveUser }) {
    return this.bookings.findMyBookings(req.user.id);
  }

  @Get('business/:businessId')
  @ApiOperation({
    summary: 'Fila de solicitações de combo da empresa (Gestor)',
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
  })
  async approve(
    @Request() req: { user: ActiveUser },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const group = await this.bookings.approve(id, req.user.id);
    return { message: 'Combo confirmado e agendas bloqueadas.', data: group };
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Recusar o combo com justificativa (Gestor)' })
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
  @ApiOperation({ summary: 'Cancelar um combo confirmado (Gestor)' })
  async cancelByManager(
    @Request() req: { user: ActiveUser },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectComboBookingDto,
  ) {
    const group = await this.bookings.cancelByManager(id, req.user.id, dto);
    return { message: 'Combo cancelado.', data: group };
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancelar a própria solicitação (Cliente)' })
  async cancel(
    @Request() req: { user: ActiveUser },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const group = await this.bookings.cancelByClient(id, req.user.id);
    return { message: 'Solicitação cancelada.', data: group };
  }
}
