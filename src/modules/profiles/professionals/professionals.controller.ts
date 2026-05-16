import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  ParseUUIDPipe,
  Req,
  UploadedFile,
} from '@nestjs/common';
import { ProfessionalsService } from './professionals.service';
import { UpdateProfessionalProfileDto } from './dto/update-professional-profile.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { LoggersInterceptor } from '../../../common/interceptors/log-interceptor';
import { SucessInterceptor } from '../../../common/interceptors/success-interceptor';
import { ActiveUser } from '../../auth/interfaces/active-user.interface';
import { ApiOperation } from '@nestjs/swagger';
import { FilesService } from '../../files/files.service';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('professionals')
@UseInterceptors(LoggersInterceptor, SucessInterceptor)
export class ProfessionalsController {
  constructor(
    private readonly professionalsService: ProfessionalsService,
    private readonly filesService: FilesService,
  ) {}

  @Patch('me/profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('professional')
  async updateProfile(
    @Req() req: { user: ActiveUser },
    @Body() updateProfessionalProfileDto: UpdateProfessionalProfileDto,
  ) {
    return this.professionalsService.updateProfile(
      req.user.id,
      updateProfessionalProfileDto,
    );
  }

  @Post('me/avatar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('professional')
  @UseInterceptors(FileInterceptor('file'))
  async updateAvatar(
    @Req() req: { user: ActiveUser },
    @UploadedFile() file: any,
  ) {
    const url = this.filesService.uploadPublicFile(file, 'avatars');
    return this.professionalsService.updateAvatar(req.user.id, url);
  }

  @Post('me/banner')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('professional')
  @UseInterceptors(FileInterceptor('file'))
  async updateBanner(
    @Req() req: { user: ActiveUser },
    @UploadedFile() file: any,
  ) {
    const url = this.filesService.uploadPublicFile(file, 'banners');
    return this.professionalsService.updateBanner(req.user.id, url);
  }

  @Post('me/portfolio')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('professional')
  @UseInterceptors(FileInterceptor('file'))
  async addPortfolioImage(
    @Req() req: { user: ActiveUser },
    @UploadedFile() file: any,
  ) {
    const imageUrl = this.filesService.uploadPublicFile(
      file,
      'portfolios',
    );
    return this.professionalsService.addPortfolioImage(req.user.id, imageUrl);
  }

  @Delete('me/portfolio/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('professional')
  async removePortfolioImage(
    @Req() req: { user: ActiveUser },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return await this.professionalsService.removePortfolioImage(
      req.user.id,
      id,
    );
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.professionalsService.findPublicProfile(id);
  }

  @Get(':id/services')
  findServices(@Param('id', ParseUUIDPipe) id: string) {
    return this.professionalsService.findProfessionalServices(id);
  }

  @Get(':id/portfolio')
  @ApiOperation({ summary: 'Listar fotos do portfólio do profissional' })
  findPortfolio(@Param('id', ParseUUIDPipe) id: string) {
    return this.professionalsService.findPortfolio(id);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  findAll() {
    return this.professionalsService.findAll();
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.professionalsService.remove(id);
  }
}
