import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
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

import { CombosService } from './combos.service';
import { ComboAvailabilityService } from './combo-availability.service';
import { CreateComboDto, UpdateComboDto } from './dto/combo.dto';
import { ComboAvailabilityQueryDto } from './dto/combo-booking.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ActiveUser } from '../auth/interfaces/active-user.interface';

@ApiTags('combos')
@Controller('combos')
export class CombosController {
  constructor(
    private readonly combosService: CombosService,
    private readonly comboAvailability: ComboAvailabilityService,
  ) {}

  @Post('business/:businessId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager')
  @ApiOperation({
    summary: 'Criar um combo promocional de serviços',
    description:
      'Permite ao gestor agrupar 2 ou mais serviços do catálogo em uma sequência ordenada com preço promocional unificado.',
  })
  @ApiParam({
    name: 'businessId',
    description: 'UUID do estabelecimento',
    example: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  })
  @ApiBody({ type: CreateComboDto })
  @ApiResponse({
    status: 201,
    description: 'Combo de serviços criado com sucesso.',
  })
  create(
    @Request() req: { user: ActiveUser },
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: CreateComboDto,
  ) {
    return this.combosService.create(businessId, req.user.id, dto);
  }

  @Get('business/:businessId')
  @ApiOperation({
    summary: 'Listar combos de uma empresa com o valor cheio e o promocional',
    description:
      'Retorna os pacotes promocionais de serviços de um estabelecimento, exibindo os itens componentes, a soma dos preços avulsos (valor cheio) e o valor promocional com desconto.',
  })
  @ApiParam({
    name: 'businessId',
    description: 'UUID do estabelecimento',
    example: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    description: 'Se "true", inclui também combos inativos na listagem',
    example: 'false',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de combos do estabelecimento retornada com sucesso.',
  })
  findAllByBusiness(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.combosService.findAllByBusiness(
      businessId,
      includeInactive === 'true',
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Detalhar um combo específico',
    description:
      'Retorna os dados completos de um combo, incluindo todos os serviços integrantes na ordem de execução configurada.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do combo',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @ApiResponse({
    status: 200,
    description: 'Detalhes do combo retornados com sucesso.',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.combosService.findOne(id);
  }

  @Get(':id/availability')
  @ApiOperation({
    summary:
      'Horários em que todos os profissionais do combo estão livres de forma sincronizada',
    description:
      'Calcula e retorna os horários de início nos quais há profissionais habilitados e disponíveis consecutivamente para executar cada etapa do combo sem intervalos ociosos.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do combo',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @ApiResponse({
    status: 200,
    description: 'Horários sincronizados disponíveis retornados com sucesso.',
  })
  availability(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ComboAvailabilityQueryDto,
  ) {
    return this.comboAvailability.getSlots({
      comboId: id,
      date: query.date,
      granularity: query.granularity,
    });
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager')
  @ApiOperation({
    summary: 'Atualizar um combo existente',
    description:
      'Permite ao gestor alterar nome, descrição, preço promocional, status de ativação ou a composição de serviços de um combo.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do combo',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @ApiBody({ type: UpdateComboDto })
  @ApiResponse({
    status: 200,
    description: 'Combo atualizado com sucesso.',
  })
  update(
    @Request() req: { user: ActiveUser },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateComboDto,
  ) {
    return this.combosService.update(id, req.user.id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager')
  @ApiOperation({
    summary: 'Remover um combo',
    description:
      'Exclui um pacote promocional de serviços do catálogo do estabelecimento.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do combo',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @ApiResponse({
    status: 200,
    description: 'Combo removido com sucesso.',
  })
  remove(
    @Request() req: { user: ActiveUser },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.combosService.remove(id, req.user.id);
  }
}
