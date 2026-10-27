import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
  Param,
  Delete,
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
import { AvailabilityService } from './availability.service';
import { CreateBusinessOperatingHourDto } from './dto/create-business-operating-hour.dto';
import { CreateProfessionalShiftDto } from './dto/create-professional-shift.dto';
import { CreateScheduleExceptionDto } from './dto/create-schedule-exception.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';

@ApiTags('availability')
@ApiBearerAuth()
@Controller('availability')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Get('operating-hours')
  @ApiOperation({
    summary: 'Consultar horários de funcionamento semanal do estabelecimento',
    description:
      'Retorna a grade de horários de abertura e fechamento configurada para cada dia da semana (0 = Domingo a 6 = Sábado) de um estabelecimento.',
  })
  @ApiQuery({
    name: 'businessId',
    required: true,
    description: 'UUID do estabelecimento',
    example: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  })
  @ApiResponse({
    status: 200,
    description: 'Grade de horários de funcionamento retornada com sucesso.',
  })
  getOperatingHours(@Query('businessId') businessId: string) {
    return this.availabilityService.getOperatingHours(businessId);
  }

  @Post('operating-hours')
  @Roles('manager', 'admin')
  @ApiOperation({
    summary: 'Criar ou atualizar horário de funcionamento do estabelecimento',
    description:
      'Define o horário de abertura, fechamento e status (aberto/fechado) para um dia da semana específico do estabelecimento. Requer perfil manager ou admin.',
  })
  @ApiBody({ type: CreateBusinessOperatingHourDto })
  @ApiResponse({
    status: 201,
    description: 'Horário de funcionamento salvo com sucesso.',
  })
  createOperatingHour(
    @Req() req: { user: ActiveUser },
    @Body() dto: CreateBusinessOperatingHourDto,
  ) {
    return this.availabilityService.createOperatingHour(dto, req.user);
  }

  @Post('shifts')
  @Roles('manager', 'professional', 'admin')
  @ApiOperation({
    summary: 'Cadastrar turno de trabalho de um profissional',
    description:
      'Registra um expediente semanal de atendimento (dia da semana, hora inicial e hora final) para o vínculo de um profissional em um estabelecimento.',
  })
  @ApiBody({ type: CreateProfessionalShiftDto })
  @ApiResponse({
    status: 201,
    description: 'Turno de trabalho criado com sucesso.',
  })
  createShift(@Body() dto: CreateProfessionalShiftDto) {
    return this.availabilityService.createShift(dto);
  }

  @Post('exceptions')
  @Roles('manager', 'professional', 'admin')
  @ApiOperation({
    summary: 'Registrar exceção ou bloqueio de agenda (folga, feriado ou ausência)',
    description:
      'Cria um bloqueio pontual ou em lote de datas (dia inteiro ou faixa de horário) para um estabelecimento ou profissional específico.',
  })
  @ApiBody({ type: CreateScheduleExceptionDto })
  @ApiResponse({
    status: 201,
    description: 'Bloqueio/exceção de agenda registrado com sucesso.',
  })
  createException(
    @Req() req: { user: ActiveUser },
    @Body() dto: CreateScheduleExceptionDto,
  ) {
    return this.availabilityService.createException(dto, req.user);
  }

  @Get('exceptions')
  @Roles('manager', 'professional', 'admin')
  @ApiOperation({
    summary: 'Listar exceções e bloqueios de agenda cadastrados',
    description:
      'Retorna os bloqueios de agenda filtrados por profissional, estabelecimento e/ou data específica.',
  })
  @ApiQuery({
    name: 'professionalId',
    required: false,
    description: 'UUID do profissional',
    example: '3b241101-e2bb-4255-8caf-4136c566a962',
  })
  @ApiQuery({
    name: 'businessId',
    required: false,
    description: 'UUID do estabelecimento',
    example: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  })
  @ApiQuery({
    name: 'date',
    required: false,
    description: 'Data específica no formato YYYY-MM-DD',
    example: '2026-11-02',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de exceções de agenda retornada com sucesso.',
  })
  getExceptions(
    @Query('professionalId') professionalId?: string,
    @Query('businessId') businessId?: string,
    @Query('date') date?: string,
  ) {
    return this.availabilityService.getExceptions(
      professionalId,
      businessId,
      date,
    );
  }

  @Delete('exceptions/:id')
  @Roles('manager', 'professional', 'admin')
  @ApiOperation({
    summary: 'Remover uma exceção ou bloqueio de agenda',
    description:
      'Exclui um bloqueio de agenda existente pelo seu UUID, reabrindo o horário correspondente para novos agendamentos.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID da exceção de agenda',
    example: 'e4eaaaf2-d142-11e1-b3e4-080027620cdd',
  })
  @ApiResponse({
    status: 200,
    description: 'Exceção removida com sucesso.',
  })
  deleteException(@Req() req: { user: ActiveUser }, @Param('id') id: string) {
    return this.availabilityService.deleteException(id, req.user);
  }

  @Get('bounds')
  @ApiOperation({
    summary: 'Calcular horários disponíveis para agendamento de um serviço',
    description:
      'Cruza o horário de funcionamento da empresa, turnos dos profissionais habilitados, duração do serviço + tempo de limpeza, agendamentos existentes e exceções para retornar os slots disponíveis na data informada.',
  })
  @ApiQuery({
    name: 'date',
    required: true,
    description: 'Data desejada no formato YYYY-MM-DD',
    example: '2026-11-15',
  })
  @ApiQuery({
    name: 'businessId',
    required: true,
    description: 'UUID do estabelecimento',
    example: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  })
  @ApiQuery({
    name: 'serviceId',
    required: true,
    description: 'UUID do serviço desejado',
    example: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  })
  @ApiQuery({
    name: 'professionalId',
    required: false,
    description: 'UUID do profissional específico (opcional)',
    example: '3b241101-e2bb-4255-8caf-4136c566a962',
  })
  @ApiResponse({
    status: 200,
    description: 'Slots de horários disponíveis retornados com sucesso.',
  })
  getAvailableBounds(
    @Query('date') date: string,
    @Query('businessId') businessId: string,
    @Query('serviceId') serviceId: string,
    @Query('professionalId') professionalId?: string,
  ) {
    return this.availabilityService.getAvailableBounds(
      date,
      businessId,
      serviceId,
      professionalId,
    );
  }

  @Get('shifts')
  @Roles('manager', 'professional', 'admin')
  @ApiOperation({
    summary: 'Listar turnos de trabalho por vínculo profissional-empresa',
    description:
      'Retorna todos os turnos semanais configurados para um vínculo específico entre profissional e estabelecimento (businessProfessionalId).',
  })
  @ApiQuery({
    name: 'businessProfessionalId',
    required: true,
    description: 'UUID do vínculo profissional-empresa',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Turnos do profissional retornados com sucesso.',
  })
  getShifts(@Query('businessProfessionalId') businessProfessionalId: string) {
    return this.availabilityService.getShiftsByBusinessProfessional(
      businessProfessionalId,
    );
  }
}
