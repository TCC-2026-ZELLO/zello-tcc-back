import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  UseInterceptors,
} from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
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

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Realizar um novo agendamento' })
  create(
    @Request() req: { user: ActiveUser },
    @Body() dto: CreateAppointmentDto,
  ) {
    return this.appointmentsService.create(dto, req.user.id);
  }
}
