import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  ParseUUIDPipe,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BusinessProfessionalsService } from './business-professionals.service';
import { CreateBusinessProfessionalDto } from './dto/create-business-professional-dto';
import { UpdateBusinessProfessionalDto } from './dto/update-business-professional.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { SucessInterceptor } from '../../common/interceptors/success-interceptor';
import { ActiveUser } from '../auth/interfaces/active-user.interface';

@ApiTags('business-management')
@ApiBearerAuth()
@UseInterceptors(SucessInterceptor)
@Controller('business-professionals')
export class BusinessProfessionalsController {
  constructor(private readonly bpService: BusinessProfessionalsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager', 'admin')
  @ApiOperation({
    summary: 'Vincular profissional a uma empresa',
    description: 'Apenas gestores da empresa podem executar.',
  })
  create(
    @Request() req: { user: ActiveUser },
    @Body() dto: CreateBusinessProfessionalDto,
  ) {
    return this.bpService.create(dto, req.user.id);
  }

  @Get('business/:businessId')
  @ApiOperation({ summary: 'Listar todos os profissionais de uma empresa' })
  findAllByBusiness(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.bpService.findAllByBusiness(businessId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ver detalhes de um vínculo específico' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.bpService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager')
  @ApiOperation({
    summary: 'Atualizar status do vínculo (ex: ativar/desativar)',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBusinessProfessionalDto,
  ) {
    return this.bpService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager')
  @ApiOperation({ summary: 'Remover profissional da empresa' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.bpService.remove(id);
  }

  @Get(':id/services')
  @ApiOperation({ summary: 'Listar serviços habilitados para este vínculo' })
  findServices(@Param('id', ParseUUIDPipe) id: string) {
    return this.bpService.findProfessionalServices(id);
  }

  @Patch(':id/services')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager')
  @ApiOperation({ summary: 'Sincronizar serviços do profissional' })
  updateServices(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { serviceIds: string[] },
  ) {
    return this.bpService.updateProfessionalServices(id, dto.serviceIds);
  }

  @Get(':id/shifts')
  @ApiOperation({
    summary: 'Listar horários de trabalho (turnos) deste vínculo',
  })
  findShifts(@Param('id', ParseUUIDPipe) id: string) {
    return this.bpService.findProfessionalShifts(id);
  }

  @Patch(':id/shifts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager')
  @ApiOperation({ summary: 'Sincronizar turnos do profissional' })
  updateShifts(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    dto: {
      shifts: { dayOfWeek: number; startTime: string; endTime: string }[];
    },
  ) {
    return this.bpService.updateProfessionalShifts(id, dto.shifts);
  }
}
