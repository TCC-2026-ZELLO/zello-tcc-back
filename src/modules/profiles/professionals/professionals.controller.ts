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
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
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
import { FilesService } from '../../files/files.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

const QUALIFICATION_FILE_OPTIONS = {
  storage: memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req: any, file: Express.Multer.File, cb: any) => {
    const ALLOWED_MIMES = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
    ];
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

@ApiTags('professionals')
@Controller('professionals')
@UseInterceptors(LoggersInterceptor, SucessInterceptor)
export class ProfessionalsController {
  constructor(
    private readonly professionalsService: ProfessionalsService,
    private readonly filesService: FilesService,
  ) {}

  @Patch('me/profile')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('professional')
  @ApiOperation({
    summary: 'Atualizar perfil público do profissional autenticado',
    description:
      'Permite ao profissional autenticado editar sua biografia, especialidade principal, link do Instagram e status de visibilidade pública nas buscas.',
  })
  @ApiBody({ type: UpdateProfessionalProfileDto })
  @ApiResponse({
    status: 200,
    description: 'Perfil profissional atualizado com sucesso.',
  })
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
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('professional')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Atualizar foto de perfil (avatar) do profissional',
    description:
      'Faz o upload de uma imagem (multipart/form-data) e atualiza a foto de perfil do profissional autenticado.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Arquivo de imagem do avatar (JPEG, PNG, WEBP)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Avatar do profissional atualizado com sucesso.',
  })
  async updateAvatar(
    @Req() req: { user: ActiveUser },
    @UploadedFile() file: any,
  ) {
    const url = await this.filesService.uploadPublicFile(file, 'avatars');
    return this.professionalsService.updateAvatar(req.user.id, url);
  }

  @Post('me/banner')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('professional')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Atualizar imagem de capa (banner) do profissional',
    description:
      'Faz o upload de uma imagem panorâmica (multipart/form-data) e define como banner da página pública do profissional.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Arquivo de imagem do banner (JPEG, PNG, WEBP)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Banner do profissional atualizado com sucesso.',
  })
  async updateBanner(
    @Req() req: { user: ActiveUser },
    @UploadedFile() file: any,
  ) {
    const url = await this.filesService.uploadPublicFile(file, 'banners');
    return this.professionalsService.updateBanner(req.user.id, url);
  }

  @Post('me/portfolio')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('professional')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Adicionar foto de trabalho ao portfólio do profissional',
    description:
      'Realiza o upload de uma foto demonstrativa de serviço realizado e adiciona à galeria de portfólio do profissional autenticado.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Foto de portfólio (JPEG, PNG, WEBP)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Foto adicionada ao portfólio com sucesso.',
  })
  async addPortfolioImage(
    @Req() req: { user: ActiveUser },
    @UploadedFile() file: any,
  ) {
    const imageUrl = await this.filesService.uploadPublicFile(
      file,
      'portfolios',
    );
    return this.professionalsService.addPortfolioImage(req.user.id, imageUrl);
  }

  @Delete('me/portfolio/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('professional')
  @ApiOperation({
    summary: 'Remover foto do portfólio do profissional',
    description:
      'Exclui uma imagem específica do portfólio pertencente ao profissional autenticado.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID da imagem do portfólio',
    example: 'b1c2d3e4-f5a6-4789-8012-34567890abcd',
  })
  @ApiResponse({
    status: 200,
    description: 'Foto removida do portfólio com sucesso.',
  })
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
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('professional', 'manager')
  @UseInterceptors(FileInterceptor('file', QUALIFICATION_FILE_OPTIONS))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Adicionar qualificação e certificado ao perfil (RF9)',
    description:
      'Cadastra uma nova formação acadêmica, certificação ou curso de especialização no perfil do profissional acompanhada do upload obrigatório do comprovante (JPEG, PNG, WEBP ou PDF de até 5 MB).',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'title'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Arquivo do certificado/diploma (JPEG, PNG, WEBP ou PDF)',
        },
        title: {
          type: 'string',
          example: 'Especialização em Visagismo e Colorimetria Avançada',
        },
        institution: {
          type: 'string',
          example: 'Academia L’Oréal Professionnel São Paulo',
        },
        type: {
          type: 'string',
          enum: ['diploma', 'specialization', 'course', 'certification'],
          example: 'specialization',
        },
        year: {
          type: 'integer',
          example: 2024,
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Qualificação cadastrada com sucesso.',
  })
  async addQualification(
    @Req() req: { user: ActiveUser },
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateQualificationDto,
  ) {
    if (!file) {
      throw new BadRequestException('Arquivo do certificado é obrigatório.');
    }
    const certificateUrl = await this.filesService.uploadPublicFile(
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
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('professional', 'manager')
  @UseInterceptors(FileInterceptor('file', QUALIFICATION_FILE_OPTIONS))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Editar qualificação do perfil profissional (RF9)',
    description:
      'Atualiza os dados de título, instituição, tipo, ano de conclusão e, opcionalmente, substitui o arquivo do certificado de uma qualificação existente.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID da qualificação',
    example: '9a8b7c6d-5e4f-4321-8765-abcdef123456',
  })
  @ApiBody({ type: UpdateQualificationDto })
  @ApiResponse({
    status: 200,
    description: 'Qualificação atualizada com sucesso.',
  })
  async updateQualification(
    @Req() req: { user: ActiveUser },
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UpdateQualificationDto,
  ) {
    const newCertificateUrl = file
      ? await this.filesService.uploadPublicFile(file, 'qualifications')
      : undefined;
    return this.professionalsService.updateQualification(
      req.user.id,
      id,
      dto,
      newCertificateUrl,
    );
  }

  @Delete('me/qualifications/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('professional', 'manager')
  @ApiOperation({
    summary: 'Remover qualificação do perfil profissional (RF9)',
    description:
      'Exclui uma qualificação e seu respectivo certificado do perfil do profissional autenticado.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID da qualificação',
    example: '9a8b7c6d-5e4f-4321-8765-abcdef123456',
  })
  @ApiResponse({
    status: 200,
    description: 'Qualificação removida com sucesso.',
  })
  async removeQualification(
    @Req() req: { user: ActiveUser },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.professionalsService.removeQualification(req.user.id, id);
  }

  // ─────────────────────────────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({
    summary: 'Consultar perfil público de um profissional por ID',
    description:
      'Retorna as informações públicas do profissional (nome, biografia, especialidade, fotos, nota média e estabelecimentos onde atua).',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do perfil profissional',
    example: '3b241101-e2bb-4255-8caf-4136c566a962',
  })
  @ApiResponse({
    status: 200,
    description: 'Perfil público do profissional retornado com sucesso.',
  })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.professionalsService.findPublicProfile(id);
  }

  @Get(':id/services')
  @ApiOperation({
    summary: 'Listar serviços realizados por um profissional',
    description:
      'Retorna a lista de serviços ativos habilitados para o profissional nos estabelecimentos em que ele atua.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do perfil profissional',
    example: '3b241101-e2bb-4255-8caf-4136c566a962',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de serviços do profissional retornada com sucesso.',
  })
  findServices(@Param('id', ParseUUIDPipe) id: string) {
    return this.professionalsService.findProfessionalServices(id);
  }

  @Get(':id/portfolio')
  @ApiOperation({
    summary: 'Listar fotos do portfólio do profissional',
    description:
      'Retorna todas as imagens públicas do portfólio de trabalhos realizados pelo profissional.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do perfil profissional',
    example: '3b241101-e2bb-4255-8caf-4136c566a962',
  })
  @ApiResponse({
    status: 200,
    description: 'Galeria de portfólio retornada com sucesso.',
  })
  findPortfolio(@Param('id', ParseUUIDPipe) id: string) {
    return this.professionalsService.findPortfolio(id);
  }

  @Get(':id/qualifications')
  @ApiOperation({
    summary: 'Listar qualificações e certificados do profissional (RF9 - CA3)',
    description:
      'Retorna todas as certificações, diplomas e cursos registrados no perfil público do profissional.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do perfil profissional',
    example: '3b241101-e2bb-4255-8caf-4136c566a962',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de qualificações retornada com sucesso.',
  })
  findQualifications(@Param('id', ParseUUIDPipe) id: string) {
    return this.professionalsService.findQualifications(id);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({
    summary: 'Listar todos os profissionais cadastrados (Apenas Admin)',
    description:
      'Retorna a listagem completa de perfis de profissionais registrados no sistema. Acesso exclusivo para administradores.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista completa de profissionais retornada com sucesso.',
  })
  findAll() {
    return this.professionalsService.findAll();
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({
    summary: 'Remover perfil de um profissional (Apenas Admin)',
    description:
      'Exclui o registro de perfil profissional correspondente ao UUID informado. Acesso exclusivo para administradores.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do perfil profissional',
    example: '3b241101-e2bb-4255-8caf-4136c566a962',
  })
  @ApiResponse({
    status: 200,
    description: 'Perfil profissional removido com sucesso.',
  })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.professionalsService.remove(id);
  }
}
