import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('catalog')
@ApiBearerAuth()
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Post('business/:businessId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager')
  @ApiOperation({
    summary: 'Cadastrar novo serviço no catálogo de um estabelecimento',
    description:
      'Adiciona um novo serviço (com nome, descrição, duração em minutos, tempo de limpeza pós-atendimento e preço) ao catálogo de uma empresa gerenciada pelo usuário autenticado.',
  })
  @ApiParam({
    name: 'businessId',
    description: 'UUID do estabelecimento',
    example: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  })
  @ApiBody({ type: CreateServiceDto })
  @ApiResponse({
    status: 201,
    description: 'Serviço cadastrado no catálogo com sucesso.',
  })
  async create(
    @Request() req,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() createServiceDto: CreateServiceDto,
  ) {
    return this.catalogService.create(
      createServiceDto,
      req.user.id,
      businessId,
    );
  }

  @Get('business/:businessId')
  @ApiOperation({
    summary: 'Listar serviços de uma empresa específica (Público)',
    description:
      'Retorna todos os serviços cadastrados no catálogo de um estabelecimento, incluindo preços, durações e profissionais vinculados.',
  })
  @ApiParam({
    name: 'businessId',
    description: 'UUID do estabelecimento',
    example: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  })
  @ApiResponse({
    status: 200,
    description: 'Catálogo de serviços do estabelecimento retornado com sucesso.',
  })
  findAllByBusiness(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.catalogService.findAllByBusiness(businessId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Ver detalhes de um serviço específico',
    description:
      'Consulta e retorna os dados completos de um serviço do catálogo a partir do seu UUID.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do serviço',
    example: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  })
  @ApiResponse({
    status: 200,
    description: 'Detalhes do serviço retornados com sucesso.',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalogService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager')
  @ApiOperation({
    summary: 'Atualizar um serviço do catálogo (Apenas gestor)',
    description:
      'Permite ao gestor alterar nome, descrição, duração, tempo de limpeza ou preço de um serviço existente.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do serviço',
    example: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  })
  @ApiBody({ type: UpdateServiceDto })
  @ApiResponse({
    status: 200,
    description: 'Serviço atualizado com sucesso.',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateServiceDto: UpdateServiceDto,
  ) {
    return this.catalogService.update(id, updateServiceDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager')
  @ApiOperation({
    summary: 'Remover um serviço e revalidar visibilidade',
    description:
      'Exclui um serviço do catálogo do estabelecimento e reavalia automaticamente se a empresa continua atendendo aos critérios de visibilidade pública.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do serviço',
    example: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  })
  @ApiResponse({
    status: 200,
    description: 'Serviço removido do catálogo com sucesso.',
  })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalogService.remove(id);
  }
}
