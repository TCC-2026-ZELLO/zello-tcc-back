import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  UseGuards,
  Request,
  ForbiddenException,
  UploadedFile,
  ParseUUIDPipe,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { LoggersInterceptor } from '../../common/interceptors/log-interceptor';
import { SucessInterceptor } from '../../common/interceptors/success-interceptor';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AnyRole, Roles } from '../../common/decorators/roles.decorator';
import { uploadOptions } from '../../common/upload/file-validation';
import { SecurityEventLogger } from '../../common/logging/security-event.logger';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { ExposeContactData } from '../../common/security/sensitive-data.interceptor';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseInterceptors(LoggersInterceptor, SucessInterceptor)
// Cada rota restringe o acesso à própria conta ou ao admin (assertSelfOrAdmin
// e RolesGuard), então o e-mail pode ser devolvido.
@ExposeContactData()
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly securityEvents: SecurityEventLogger,
  ) {}

  /**
   * Regra de posse (v5.0.0-8.2.2): operações sobre uma conta só são aceitas
   * quando o alvo é a conta do próprio solicitante ou quando ele é admin.
   */
  private assertSelfOrAdmin(req: any, id: string, message: string) {
    if (req.user.id !== id && !req.user.roles?.includes('admin')) {
      throw new ForbiddenException(message);
    }
  }

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60 * 60_000 } })
  @UseInterceptors(FileInterceptor('photo', uploadOptions('image')))
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiOperation({
    summary: 'Cadastrar novo usuário (Cliente, Profissional ou Estabelecimento)',
    description:
      'Cria uma nova conta de usuário no sistema Zello e provisiona automaticamente o perfil correspondente (Cliente, Profissional ou Estabelecimento com endereço geocodificado). Suporta envio em JSON ou multipart/form-data com foto opcional.',
  })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({
    status: 201,
    description: 'Usuário criado com sucesso.',
    schema: {
      example: {
        status: 201,
        data: {
          id: 'a3f1c2d4-e5b6-4890-abcd-ef1234567890',
          nome: 'Mariana Costa Silva',
          email: 'mariana.costa@zello.com.br',
          phone: '41998765432',
          roles: [{ id: 1, name: 'client' }],
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Dados de entrada inválidos.' })
  @ApiResponse({
    status: 409,
    description: 'E-mail, CPF ou CNPJ já cadastrado.',
  })
  async create(
    @Body() createUserDto: CreateUserDto,
    @UploadedFile() photo?: Express.Multer.File,
  ) {
    return this.usersService.create(createUserDto, photo);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Obter perfil do usuário autenticado',
    description:
      'Retorna os dados completos da conta autenticada extraídos do token JWT e suas permissões ativas.',
  })
  @ApiResponse({
    status: 200,
    description: 'Perfil retornado com sucesso.',
    schema: {
      example: {
        message: 'Acesso autorizado!',
        userLoggedIn: {
          id: 'a3f1c2d4-e5b6-4890-abcd-ef1234567890',
          email: 'mariana.costa@zello.com.br',
          roles: ['client'],
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Token inválido ou ausente.' })
  getProfile(@Request() req) {
    return {
      message: 'Acesso autorizado!',
      userLoggedIn: req.user,
    };
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Listar todos os usuários cadastrados',
    description:
      'Retorna a listagem completa de usuários e seus respectivos perfis vinculados. Acesso restrito a usuários com role **manager**.',
  })
  @ApiResponse({ status: 200, description: 'Lista de usuários retornada.' })
  @ApiResponse({ status: 403, description: 'Sem permissão de acesso.' })
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Buscar usuário por ID',
    description:
      'Consulta e retorna os dados públicos e vínculos de perfil (client, professional, manager) de um usuário específico a partir do seu UUID.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do usuário',
    example: 'a3f1c2d4-e5b6-4890-abcd-ef1234567890',
  })
  @ApiResponse({ status: 200, description: 'Usuário encontrado.' })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado.' })
  findOne(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    this.assertSelfOrAdmin(
      req,
      id,
      'Você não tem permissão para consultar este usuário.',
    );
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Atualizar dados cadastrais do usuário',
    description:
      'Permite atualizar informações pessoais, preferências de lembretes (E-mail/WhatsApp), endereço ou senha. Apenas o próprio titular da conta ou um administrador pode executar esta operação.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do usuário',
    example: 'a3f1c2d4-e5b6-4890-abcd-ef1234567890',
  })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({ status: 200, description: 'Usuário atualizado com sucesso.' })
  @ApiResponse({
    status: 403,
    description: 'Sem permissão para alterar este usuário.',
  })
  async update(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    this.assertSelfOrAdmin(
      req,
      id,
      'Você não tem permissão para alterar este usuário.',
    );
    const result = await this.usersService.update(id, updateUserDto, {
      requesterId: req.user.id,
      requesterIsAdmin: req.user.roles?.includes('admin') ?? false,
      currentSessionId: req.user.sessionId,
    });
    if (updateUserDto.password) {
      this.securityEvents.log('password_changed', req, { targetUserId: id });
    }
    return result;
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Remover conta de usuário',
    description:
      'Exclui permanentemente o registro do usuário do sistema. Operação permitida exclusivamente ao próprio titular da conta ou a um administrador.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do usuário',
    example: 'a3f1c2d4-e5b6-4890-abcd-ef1234567890',
  })
  @ApiResponse({ status: 200, description: 'Usuário removido com sucesso.' })
  @ApiResponse({
    status: 403,
    description: 'Sem permissão para excluir este usuário.',
  })
  remove(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    this.assertSelfOrAdmin(
      req,
      id,
      'Você não tem permissão para excluir este usuário.',
    );
    this.securityEvents.log('account_status_changed', req, {
      targetUserId: id,
      action: 'soft_delete',
    });
    return this.usersService.remove(id);
  }

  @Post('profiles/:type')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Adicionar um perfil à própria conta',
    description:
      'Vincula um perfil de cliente, profissional ou gestor à conta do usuário autenticado. O alvo é sempre a própria conta: não há identificador de usuário na rota.',
  })
  @ApiParam({ name: 'type', enum: ['client', 'professional', 'manager'] })
  async appendOwnProfile(@Request() req, @Param('type') type: string) {
    if (type === 'client') await this.usersService.appendClient(req.user.id);
    else if (type === 'professional')
      await this.usersService.appendProfessional(req.user.id);
    else if (type === 'manager')
      await this.usersService.appendManager(req.user.id);
    else throw new BadRequestException('Tipo de perfil inválido.');

    this.securityEvents.log('role_granted', req, { role: type });
    return this.usersService.findOne(req.user.id);
  }

  @Post(':id/append-client')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @AnyRole()
  @ApiOperation({
    summary: 'Vincular perfil de Cliente a um usuário existente',
    description:
      'Adiciona a role e a entidade de perfil de Cliente a um usuário já registrado, permitindo que profissionais ou gestores também realizem agendamentos como clientes.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do usuário',
    example: 'a3f1c2d4-e5b6-4890-abcd-ef1234567890',
  })
  @ApiResponse({
    status: 201,
    description: 'Perfil de cliente criado com sucesso.',
  })
  @ApiResponse({
    status: 200,
    description: 'O usuário já possui um perfil de cliente vinculado.',
  })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado.' })
  @ApiResponse({ status: 400, description: 'ID de usuário inválido.' })
  async append_client(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    this.assertSelfOrAdmin(
      req,
      id,
      'Você não tem permissão para alterar os perfis deste usuário.',
    );
    return this.usersService.appendClient(id);
  }

  @Post(':id/append-professional')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @AnyRole()
  @ApiOperation({
    summary: 'Vincular perfil de Profissional a um usuário existente',
    description:
      'Adiciona a role e a entidade de perfil de Profissional a um usuário existente para que possa prestar serviços em estabelecimentos.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do usuário',
    example: 'a3f1c2d4-e5b6-4890-abcd-ef1234567890',
  })
  @ApiResponse({
    status: 201,
    description: 'Perfil de profissional criado com sucesso.',
  })
  @ApiResponse({
    status: 200,
    description: 'O usuário já possui um perfil de profissional vinculado.',
  })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado.' })
  @ApiResponse({ status: 400, description: 'ID de usuário inválido.' })
  async append_professional(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    this.assertSelfOrAdmin(
      req,
      id,
      'Você não tem permissão para alterar os perfis deste usuário.',
    );
    return this.usersService.appendProfessional(id);
  }

  @Post(':id/append-manager')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @AnyRole()
  @ApiOperation({
    summary: 'Vincular perfil de Gestor (Manager) a um usuário existente',
    description:
      'Adiciona a role e a entidade de perfil de Gestor a um usuário já cadastrado, habilitando-o a administrar estabelecimentos.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do usuário',
    example: 'a3f1c2d4-e5b6-4890-abcd-ef1234567890',
  })
  @ApiResponse({
    status: 201,
    description: 'Perfil de gerente criado com sucesso.',
  })
  @ApiResponse({
    status: 200,
    description: 'O usuário já possui um perfil de gerente vinculado.',
  })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado.' })
  @ApiResponse({ status: 400, description: 'ID de usuário inválido.' })
  async append_manager(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    this.assertSelfOrAdmin(
      req,
      id,
      'Você não tem permissão para alterar os perfis deste usuário.',
    );
    return this.usersService.appendManager(id);
  }

  @Patch(':id/promote-to-admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({
    summary: 'Promover usuário a Administrador do sistema',
    description:
      'Atribui a role global de administrador (**admin**) ao usuário especificado pelo UUID.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do usuário a ser promovido',
    example: 'a3f1c2d4-e5b6-4890-abcd-ef1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'Usuário promovido a administrador com sucesso.',
  })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado.' })
  async promoteToAdmin(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    this.securityEvents.log('role_granted', req, {
      targetUserId: id,
      role: 'admin',
    });
    return await this.usersService.become_admin(id);
  }

  @Delete(':id/sessions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Encerrar todas as sessões de um usuário (Apenas Admin)',
    description:
      'Revoga imediatamente todas as sessões ativas do usuário informado (v5.0.0-7.4.5). Os tokens de acesso já emitidos deixam de ser aceitos na requisição seguinte.',
  })
  @ApiParam({ name: 'id', description: 'UUID do usuário' })
  async terminateSessions(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const result = await this.usersService.revokeSessions(id);
    this.securityEvents.log('sessions_revoked', req, {
      targetUserId: id,
      revoked: result.revoked,
    });
    return { message: 'Sessões encerradas.', ...result };
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({
    summary: 'Ativar ou desativar uma conta (Apenas Admin)',
    description:
      'Altera o status da conta. Desativar encerra todas as sessões do usuário na mesma operação (v5.0.0-7.4.2).',
  })
  @ApiParam({ name: 'id', description: 'UUID do usuário' })
  async updateStatus(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    const result = await this.usersService.setActive(id, dto.isActive);
    this.securityEvents.log('account_status_changed', req, {
      targetUserId: id,
      isActive: dto.isActive,
    });
    return result;
  }
}
