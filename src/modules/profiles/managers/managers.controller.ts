import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ManagersService } from './managers.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';

@ApiTags('managers')
@ApiBearerAuth()
@Controller('managers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('manager', 'admin')
export class ManagersController {
  constructor(private readonly managersService: ManagersService) {}

  @Post()
  @ApiOperation({
    summary: 'Criar perfil de gestor',
    description:
      'Registra uma nova entidade de perfil de gestor (Manager). Requer permissão de manager ou admin.',
  })
  @ApiResponse({
    status: 201,
    description: 'Perfil de gestor criado com sucesso.',
  })
  create() {
    return this.managersService.create();
  }

  @Get()
  @ApiOperation({
    summary: 'Listar todos os perfis de gestores',
    description:
      'Retorna a listagem completa de perfis de gestores cadastrados no sistema.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de gestores retornada com sucesso.',
  })
  findAll() {
    return this.managersService.findAll();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Consultar perfil de gestor por ID',
    description:
      'Retorna os detalhes de um perfil de gestor específico a partir do seu UUID.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do perfil de gestor',
    example: '8f14e45f-ceea-467a-9a38-1b4d5e6f7a8b',
  })
  @ApiResponse({
    status: 200,
    description: 'Perfil de gestor encontrado.',
  })
  findOne(@Param('id') id: string) {
    return this.managersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Atualizar perfil de gestor',
    description:
      'Atualiza as informações vinculadas ao perfil de gestor especificado pelo UUID.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do perfil de gestor',
    example: '8f14e45f-ceea-467a-9a38-1b4d5e6f7a8b',
  })
  @ApiResponse({
    status: 200,
    description: 'Perfil de gestor atualizado com sucesso.',
  })
  update(@Param('id') id: string) {
    return this.managersService.update(id);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Remover perfil de gestor',
    description:
      'Exclui o registro de perfil de gestor identificado pelo UUID.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do perfil de gestor',
    example: '8f14e45f-ceea-467a-9a38-1b4d5e6f7a8b',
  })
  @ApiResponse({
    status: 200,
    description: 'Perfil de gestor removido com sucesso.',
  })
  remove(@Param('id') id: string) {
    return this.managersService.remove(id);
  }
}
