import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ClientsService } from './clients.service';
import { UpdateClientDto } from './dto/update-client.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('clients')
@ApiBearerAuth()
@Controller('clients')
@UseGuards(JwtAuthGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  @ApiOperation({
    summary: 'Criar registro de perfil de cliente',
    description:
      'Inicializa um novo registro de perfil de cliente na base de dados.',
  })
  @ApiResponse({
    status: 201,
    description: 'Perfil de cliente criado com sucesso.',
  })
  create() {
    return this.clientsService.create();
  }

  @Get()
  @ApiOperation({
    summary: 'Listar todos os perfis de clientes',
    description:
      'Retorna a listagem de todos os perfis de clientes cadastrados e suas métricas de reputação (noShowCount e successStreak).',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de clientes retornada com sucesso.',
  })
  findAll() {
    return this.clientsService.findAll();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Consultar perfil de cliente por ID',
    description:
      'Retorna os dados do perfil de um cliente específico e seus indicadores de comparecimento pelo seu UUID.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do perfil de cliente',
    example: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
  })
  @ApiResponse({
    status: 200,
    description: 'Perfil de cliente retornado com sucesso.',
  })
  findOne(@Param('id') id: string) {
    return this.clientsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Atualizar indicadores do perfil de cliente',
    description:
      'Permite atualizar os contadores de faltas injustificadas (noShowCount) e sequência de comparecimentos (successStreak) de um cliente.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do perfil de cliente',
    example: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
  })
  @ApiBody({ type: UpdateClientDto })
  @ApiResponse({
    status: 200,
    description: 'Perfil de cliente atualizado com sucesso.',
  })
  update(@Param('id') id: string, @Body() updateClientDto: UpdateClientDto) {
    return this.clientsService.update(id, updateClientDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Remover perfil de cliente',
    description:
      'Remove o registro de perfil de cliente correspondente ao UUID informado.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do perfil de cliente',
    example: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
  })
  @ApiResponse({
    status: 200,
    description: 'Perfil de cliente removido com sucesso.',
  })
  remove(@Param('id') id: string) {
    return this.clientsService.remove(id);
  }
}
