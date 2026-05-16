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
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
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
      'Admins podem vincular qualquer um. Managers só podem vincular outros se já gerenciarem a empresa alvo.',
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
  })
  findAll() {
    return this.bmService.findAll();
  }

  @Get('business/:businessId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Listar gestores de uma empresa específica' })
  findByBusiness(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.bmService.findByBusiness(businessId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Ver detalhes de um vínculo de gestão' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.bmService.findOne(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Remover permissão de gestão' })
  remove(
    @Request() req: { user: ActiveUser },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.bmService.remove(id, req.user);
  }
}
