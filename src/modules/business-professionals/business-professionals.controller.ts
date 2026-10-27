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
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { BusinessProfessionalsService } from './business-professionals.service';
import { CreateBusinessProfessionalDto } from './dto/create-business-professional-dto';
import {
  UpdateBusinessProfessionalDto,
  UpdateProfessionalServicesDto,
  UpdateProfessionalShiftsDto,
} from './dto/update-business-professional.dto';
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
    description:
      'Associa um profissional cadastrado (via e-mail) ao quadro de especialistas de um estabelecimento. Apenas gestores do próprio estabelecimento ou administradores podem executar esta ação.',
  })
  @ApiBody({ type: CreateBusinessProfessionalDto })
  @ApiResponse({
    status: 201,
    description: 'Profissional vinculado ao estabelecimento com sucesso.',
  })
  create(
    @Request() req: { user: ActiveUser },
    @Body() dto: CreateBusinessProfessionalDto,
  ) {
    return this.bpService.create(dto, req.user.id);
  }

  @Get('business/:businessId')
  @ApiOperation({
    summary: 'Listar todos os profissionais de uma empresa',
    description:
      'Retorna a equipe completa de profissionais vinculados a um estabelecimento, incluindo status do vínculo, dados do usuário, serviços habilitados e turnos.',
  })
  @ApiParam({
    name: 'businessId',
    description: 'UUID do estabelecimento',
    example: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de profissionais do estabelecimento retornada.',
  })
  findAllByBusiness(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.bpService.findAllByBusiness(businessId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Ver detalhes de um vínculo específico entre profissional e empresa',
    description:
      'Consulta e retorna os dados detalhados de um vínculo profissional-estabelecimento pelo seu UUID.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do vínculo profissional-empresa (business_professional)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Detalhes do vínculo retornados com sucesso.',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.bpService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager')
  @ApiOperation({
    summary: 'Atualizar status do vínculo (ex: ativar/desativar)',
    description:
      'Permite ao gestor ativar ou inativar temporariamente a participação do profissional na agenda do estabelecimento.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do vínculo profissional-empresa',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiBody({ type: UpdateBusinessProfessionalDto })
  @ApiResponse({
    status: 200,
    description: 'Status do vínculo atualizado com sucesso.',
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
  @ApiOperation({
    summary: 'Remover profissional da empresa',
    description:
      'Encerra e remove o vínculo do profissional com o estabelecimento, revalidando a visibilidade pública da empresa.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do vínculo profissional-empresa',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Profissional desvinculado com sucesso.',
  })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.bpService.remove(id);
  }

  @Get(':id/services')
  @ApiOperation({
    summary: 'Listar serviços habilitados para este vínculo',
    description:
      'Retorna todos os serviços do catálogo do estabelecimento que este profissional está autorizado a executar.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do vínculo profissional-empresa',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de serviços habilitados retornada com sucesso.',
  })
  findServices(@Param('id', ParseUUIDPipe) id: string) {
    return this.bpService.findProfessionalServices(id);
  }

  @Patch(':id/services')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager')
  @ApiOperation({
    summary: 'Sincronizar serviços habilitados do profissional',
    description:
      'Substitui a lista de serviços do catálogo que o profissional realiza neste estabelecimento pela lista de UUIDs informada no corpo da requisição.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do vínculo profissional-empresa',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiBody({ type: UpdateProfessionalServicesDto })
  @ApiResponse({
    status: 200,
    description: 'Serviços do profissional sincronizados com sucesso.',
  })
  updateServices(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProfessionalServicesDto,
  ) {
    return this.bpService.updateProfessionalServices(id, dto.serviceIds);
  }

  @Get(':id/shifts')
  @ApiOperation({
    summary: 'Listar horários de trabalho (turnos) deste vínculo',
    description:
      'Retorna a escala semanal de turnos de atendimento configurada para o profissional neste estabelecimento.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do vínculo profissional-empresa',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Turnos de trabalho retornados com sucesso.',
  })
  findShifts(@Param('id', ParseUUIDPipe) id: string) {
    return this.bpService.findProfessionalShifts(id);
  }

  @Patch(':id/shifts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager')
  @ApiOperation({
    summary: 'Sincronizar turnos semanais do profissional',
    description:
      'Substitui os turnos de expediente semanal do profissional neste estabelecimento pelos turnos enviados no payload.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do vínculo profissional-empresa',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiBody({ type: UpdateProfessionalShiftsDto })
  @ApiResponse({
    status: 200,
    description: 'Turnos do profissional sincronizados com sucesso.',
  })
  updateShifts(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProfessionalShiftsDto,
  ) {
    return this.bpService.updateProfessionalShifts(id, dto.shifts);
  }
}
