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
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

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
  @ApiOperation({ summary: 'Criar um combo de serviços' })
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
  @ApiOperation({ summary: 'Detalhar um combo' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.combosService.findOne(id);
  }

  @Get(':id/availability')
  @ApiOperation({
    summary:
      'Horários em que todos os profissionais do combo estão livres de forma sincronizada',
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
  @ApiOperation({ summary: 'Atualizar um combo' })
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
  @ApiOperation({ summary: 'Remover um combo' })
  remove(
    @Request() req: { user: ActiveUser },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.combosService.remove(id, req.user.id);
  }
}
