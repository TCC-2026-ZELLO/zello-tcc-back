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
  BadRequestException,
} from '@nestjs/common';
import { ProfessionalsService } from './professionals.service';
import { UpdateProfessionalProfileDto } from './dto/update-professional-profile.dto';
import { CreateQualificationDto } from './dto/create-qualification.dto';
import { UpdateQualificationDto } from './dto/update-qualification.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { LoggersInterceptor } from '../../../common/interceptors/log-interceptor';
import { SucessInterceptor } from '../../../common/interceptors/success-interceptor';
import { ActiveUser } from '../../auth/interfaces/active-user.interface';
import { ApiOperation } from '@nestjs/swagger';
import { FilesService } from '../../files/files.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

const QUALIFICATION_FILE_OPTIONS = {
  storage: memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req: any, file: Express.Multer.File, cb: any) => {
    const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new BadRequestException(
          'Formato de arquivo não suportado. Envie JPEG, PNG, WEBP ou PDF.',
        ),
        false,
      );
    }
  },
};

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
    const imageUrl = this.filesService.uploadPublicFile(file, 'portfolios');
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

  // ─── Qualificações ───────────────────────────────────────────────────────────

  @Post('me/qualifications')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('professional', 'manager')
  @UseInterceptors(FileInterceptor('file', QUALIFICATION_FILE_OPTIONS))
  @ApiOperation({ summary: 'Adicionar qualificação ao perfil (RF9)' })
  async addQualification(
    @Req() req: { user: ActiveUser },
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateQualificationDto,
  ) {
    if (!file) {
      throw new BadRequestException('Arquivo do certificado é obrigatório.');
    }
    const certificateUrl = this.filesService.uploadPublicFile(
      file,
      'qualifications',
    );
    return this.professionalsService.addQualification(
      req.user.id,
      dto,
      certificateUrl,
    );
  }

  @Patch('me/qualifications/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('professional', 'manager')
  @UseInterceptors(FileInterceptor('file', QUALIFICATION_FILE_OPTIONS))
  @ApiOperation({ summary: 'Editar qualificação do perfil (RF9)' })
  async updateQualification(
    @Req() req: { user: ActiveUser },
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UpdateQualificationDto,
  ) {
    const newCertificateUrl = file
      ? this.filesService.uploadPublicFile(file, 'qualifications')
      : undefined;
    return this.professionalsService.updateQualification(
      req.user.id,
      id,
      dto,
      newCertificateUrl,
    );
  }

  @Delete('me/qualifications/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('professional', 'manager')
  @ApiOperation({ summary: 'Remover qualificação do perfil (RF9)' })
  async removeQualification(
    @Req() req: { user: ActiveUser },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.professionalsService.removeQualification(req.user.id, id);
  }

  // ─────────────────────────────────────────────────────────────────────────────

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

  @Get(':id/qualifications')
  @ApiOperation({ summary: 'Listar qualificações do profissional (RF9 - CA3)' })
  findQualifications(@Param('id', ParseUUIDPipe) id: string) {
    return this.professionalsService.findQualifications(id);
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
