import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ManagersService } from './managers.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';

@Controller('managers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('manager', 'admin')
export class ManagersController {
  constructor(private readonly managersService: ManagersService) {}

  @Post()
  create() {
    return this.managersService.create();
  }

  @Get()
  findAll() {
    return this.managersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.managersService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string) {
    return this.managersService.update(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.managersService.remove(id);
  }
}
