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
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { BusinessesService } from './businesses.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessProfileDto } from './dto/update-business.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { FileInterceptor } from '@nestjs/platform-express';
import { FilesService } from '../files/files.service';

@ApiTags('businesses')
@ApiBearerAuth()
@Controller('businesses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BusinessesController {
  constructor(
    private readonly businessesService: BusinessesService,
    private readonly filesService: FilesService,
  ) {}

  @Patch(':id/profile')
  @Roles('manager', 'admin')
  @ApiOperation({
    summary: 'Atualizar perfil comercial do estabelecimento',
    description:
      'Permite ao gestor responsável ou administrador editar o nome fantasia (tradeName), descrição comercial, status de visibilidade e fuso horário (timezone) do estabelecimento.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do estabelecimento',
    example: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  })
  @ApiBody({ type: UpdateBusinessProfileDto })
  @ApiResponse({
    status: 200,
    description: 'Perfil do estabelecimento atualizado com sucesso.',
  })
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
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Atualizar foto de perfil (logo) do estabelecimento',
    description:
      'Faz o upload de uma nova imagem (multipart/form-data) para o armazenamento público (Azure Blob Storage ou diretório local) e define-a como foto principal do estabelecimento.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do estabelecimento',
    example: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Arquivo de imagem da logo do estabelecimento (JPEG, PNG, WEBP)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Foto principal do estabelecimento atualizada com sucesso.',
  })
  async updatePhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: ActiveUser },
    @UploadedFile() file: any,
  ) {
    const url = await this.filesService.uploadPublicFile(
      file,
      'business-photos',
    );
    return this.businessesService.updatePhoto(id, req.user.id, url);
  }

  @Post(':id/banner')
  @Roles('manager', 'admin')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Atualizar imagem de capa (banner) do estabelecimento',
    description:
      'Faz o upload de uma imagem panorâmica (multipart/form-data) e atualiza a foto de capa exibida no topo da página pública do estabelecimento.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do estabelecimento',
    example: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
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
    description: 'Banner do estabelecimento atualizado com sucesso.',
  })
  async updateBanner(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: ActiveUser },
    @UploadedFile() file: any,
  ) {
    const url = await this.filesService.uploadPublicFile(
      file,
      'business-banners',
    );
    return this.businessesService.updateBanner(id, req.user.id, url);
  }

  @Post(':id/gallery')
  @Roles('manager', 'admin')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Adicionar foto à galeria do estabelecimento',
    description:
      'Realiza o upload de uma fotografia do ambiente ou de trabalhos realizados e adiciona à galeria pública do estabelecimento.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do estabelecimento',
    example: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Arquivo de imagem para a galeria (JPEG, PNG, WEBP)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Imagem adicionada à galeria com sucesso.',
  })
  async addGalleryImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: ActiveUser },
    @UploadedFile() file: any,
  ) {
    const url = await this.filesService.uploadPublicFile(
      file,
      'business-gallery',
    );
    return this.businessesService.addGalleryImage(id, req.user.id, url);
  }

  @Delete(':id/gallery/:imageId')
  @Roles('manager', 'admin')
  @ApiOperation({
    summary: 'Remover foto da galeria do estabelecimento',
    description:
      'Exclui uma imagem específica da galeria pública do estabelecimento a partir do seu UUID.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do estabelecimento',
    example: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  })
  @ApiParam({
    name: 'imageId',
    description: 'UUID da imagem na galeria',
    example: 'b1c2d3e4-f5a6-4789-8012-34567890abcd',
  })
  @ApiResponse({
    status: 200,
    description: 'Imagem removida da galeria com sucesso.',
  })
  async removeGalleryImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @Req() req: { user: ActiveUser },
  ) {
    return this.businessesService.removeGalleryImage(id, req.user.id, imageId);
  }

  @Get('me')
  @Roles('manager', 'admin')
  @ApiOperation({
    summary: 'Listar estabelecimentos gerenciados pelo usuário logado',
    description:
      'Retorna todas as empresas vinculadas ao gestor autenticado (incluindo endereço, catálogo de serviços e status de visibilidade).',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de estabelecimentos do gestor retornada com sucesso.',
  })
  async findMyBusinesses(@Req() req: { user: ActiveUser }) {
    return this.businessesService.findMyBusinesses(req.user.id);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Consultar detalhes de um estabelecimento por ID',
    description:
      'Retorna os dados cadastrais, perfil público, endereço, fotos e configurações de um estabelecimento específico.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do estabelecimento',
    example: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  })
  @ApiResponse({
    status: 200,
    description: 'Dados do estabelecimento retornados com sucesso.',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.businessesService.findOne(id);
  }

  @Get(':id/gallery')
  @ApiOperation({
    summary: 'Listar fotos da galeria de um estabelecimento',
    description:
      'Retorna todas as imagens cadastradas na galeria pública de um estabelecimento.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do estabelecimento',
    example: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de imagens da galeria retornada com sucesso.',
  })
  findGallery(@Param('id', ParseUUIDPipe) id: string) {
    return this.businessesService.findGallery(id);
  }

  @Post()
  @Roles('admin', 'manager')
  @ApiOperation({
    summary: 'Cadastrar um novo estabelecimento',
    description:
      'Cria um novo estabelecimento na plataforma e vincula automaticamente o gestor autenticado como responsável.',
  })
  @ApiBody({ type: CreateBusinessDto })
  @ApiResponse({
    status: 201,
    description: 'Estabelecimento criado com sucesso.',
  })
  create(@Req() req: { user: ActiveUser }, @Body() dto: CreateBusinessDto) {
    return this.businessesService.create(dto, req.user);
  }

  @Get()
  @Roles('admin')
  @ApiOperation({
    summary: 'Listar todos os estabelecimentos cadastrados (Apenas Admin)',
    description:
      'Retorna todos os estabelecimentos da base de dados, independentemente do status de visibilidade. Acesso restrito a administradores.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista completa de estabelecimentos retornada.',
  })
  findAll() {
    return this.businessesService.findAll();
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({
    summary: 'Remover um estabelecimento (Apenas Admin)',
    description:
      'Exclui um estabelecimento da plataforma pelo seu UUID. Operação restrita a administradores.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do estabelecimento',
    example: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  })
  @ApiResponse({
    status: 200,
    description: 'Estabelecimento removido com sucesso.',
  })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.businessesService.remove(id);
  }
}
