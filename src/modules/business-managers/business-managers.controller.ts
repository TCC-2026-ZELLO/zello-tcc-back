import {
  Controller,
  Get,
  Post,
  Body,
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
import { BusinessManagersService } from './business-managers.service';
import { CreateBusinessManagerDto } from './dto/create-business-manager.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { SucessInterceptor } from '../../common/interceptors/success-interceptor';
import { ActiveUser } from '../auth/interfaces/active-user.interface';

@ApiTags('business-administration')
@ApiBearerAuth()
@UseInterceptors(SucessInterceptor)
@Controller('business-managers')
export class BusinessManagersController {
  constructor(private readonly bmService: BusinessManagersService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  @ApiOperation({
    summary: 'Vincular gestor a uma empresa',
    description:
      'Cria um vínculo de administração entre um perfil de gestor (Manager) e um estabelecimento (Business). Administradores podem vincular qualquer gestor; gestores só podem adicionar novos gestores a empresas que já administram.',
  })
  @ApiBody({ type: CreateBusinessManagerDto })
  @ApiResponse({
    status: 201,
    description: 'Gestor vinculado ao estabelecimento com sucesso.',
  })
  create(
    @Request() req: { user: ActiveUser },
    @Body() dto: CreateBusinessManagerDto,
  ) {
    return this.bmService.create(dto, req.user);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({
    summary: 'Listar todos os vínculos de gestão (Apenas Admin)',
    description:
      'Retorna a listagem completa de todos os vínculos entre gestores e estabelecimentos registrados na plataforma. Acesso exclusivo para administradores.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de vínculos de gestão retornada com sucesso.',
  })
  findAll() {
    return this.bmService.findAll();
  }

  @Get('business/:businessId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  @ApiOperation({
    summary: 'Listar gestores de uma empresa específica',
    description:
      'Retorna todos os gestores que possuem permissão de administração sobre o estabelecimento informado.',
  })
  @ApiParam({
    name: 'businessId',
    description: 'UUID do estabelecimento',
    example: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de gestores da empresa retornada com sucesso.',
  })
  findByBusiness(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.bmService.findByBusiness(businessId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Ver detalhes de um vínculo de gestão',
    description:
      'Consulta e retorna as informações detalhadas de um vínculo específico entre gestor e estabelecimento pelo seu UUID.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do vínculo de gestão (business_manager)',
    example: '8f14e45f-ceea-467a-9a38-1b4d5e6f7a8b',
  })
  @ApiResponse({
    status: 200,
    description: 'Detalhes do vínculo retornados com sucesso.',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.bmService.findOne(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  @ApiOperation({
    summary: 'Remover permissão de gestão',
    description:
      'Revoga o vínculo de administração de um gestor sobre um estabelecimento. Apenas administradores ou gestores da mesma empresa podem realizar a remoção.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do vínculo de gestão a ser removido',
    example: '8f14e45f-ceea-467a-9a38-1b4d5e6f7a8b',
  })
  @ApiResponse({
    status: 200,
    description: 'Permissão de gestão removida com sucesso.',
  })
  remove(
    @Request() req: { user: ActiveUser },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.bmService.remove(id, req.user);
  }
}
