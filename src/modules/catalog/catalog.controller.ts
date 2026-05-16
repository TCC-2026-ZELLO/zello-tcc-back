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
import { CatalogService } from './catalog.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
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
  })
  findAllByBusiness(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.catalogService.findAllByBusiness(businessId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ver detalhes de um serviço' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalogService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager')
  @ApiOperation({ summary: 'Atualizar um serviço (Apenas gestor)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateServiceDto: UpdateServiceDto,
  ) {
    return this.catalogService.update(id, updateServiceDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager')
  @ApiOperation({ summary: 'Remover um serviço e revalidar visibilidade' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalogService.remove(id);
  }
}
