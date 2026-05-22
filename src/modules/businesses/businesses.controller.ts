import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  ParseUUIDPipe,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { BusinessesService } from './businesses.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessProfileDto } from './dto/update-business.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiTags } from '@nestjs/swagger';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { FileInterceptor } from '@nestjs/platform-express';
import { FilesService } from '../files/files.service';

@ApiTags('businesses')
@Controller('businesses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BusinessesController {
  constructor(
    private readonly businessesService: BusinessesService,
    private readonly filesService: FilesService,
  ) {}

  @Patch(':id/profile')
  @Roles('manager', 'admin')
  async updateProfile(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: ActiveUser },
    @Body() dto: UpdateBusinessProfileDto,
  ) {
    return this.businessesService.updateProfile(id, req.user.id, dto);
  }

  @Post(':id/photo')
  @Roles('manager', 'admin')
  @UseInterceptors(FileInterceptor('file'))
  async updatePhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: ActiveUser },
    @UploadedFile() file: any,
  ) {
    const url = this.filesService.uploadPublicFile(file, 'business-photos');
    return this.businessesService.updatePhoto(id, req.user.id, await url);
  }

  @Post(':id/banner')
  @Roles('manager', 'admin')
  @UseInterceptors(FileInterceptor('file'))
  async updateBanner(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: ActiveUser },
    @UploadedFile() file: any,
  ) {
    const url = this.filesService.uploadPublicFile(file, 'business-banners');
    return this.businessesService.updateBanner(id, req.user.id, await url);
  }

  @Post(':id/gallery')
  @Roles('manager', 'admin')
  @UseInterceptors(FileInterceptor('file'))
  async addGalleryImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: ActiveUser },
    @UploadedFile() file: any,
  ) {
    const url = this.filesService.uploadPublicFile(file, 'business-gallery');
    return this.businessesService.addGalleryImage(id, req.user.id, await url);
  }

  @Delete(':id/gallery/:imageId')
  @Roles('manager', 'admin')
  async removeGalleryImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @Req() req: { user: ActiveUser },
  ) {
    return this.businessesService.removeGalleryImage(id, req.user.id, imageId);
  }

  @Get('me')
  @Roles('manager', 'admin')
  async findMyBusinesses(@Req() req: { user: ActiveUser }) {
    return this.businessesService.findMyBusinesses(req.user.id);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.businessesService.findOne(id);
  }

  @Get(':id/gallery')
  findGallery(@Param('id', ParseUUIDPipe) id: string) {
    return this.businessesService.findGallery(id);
  }

  @Post()
  @Roles('admin', 'manager')
  create(@Req() req: { user: ActiveUser }, @Body() dto: CreateBusinessDto) {
    return this.businessesService.create(dto, req.user);
  }

  @Get()
  @Roles('admin')
  findAll() {
    return this.businessesService.findAll();
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.businessesService.remove(id);
  }
}
