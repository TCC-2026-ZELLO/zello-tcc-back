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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { LoggersInterceptor } from '../../common/interceptors/log-interceptor';
import { SucessInterceptor } from '../../common/interceptors/success-interceptor';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseInterceptors(LoggersInterceptor, SucessInterceptor)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({
    summary: 'Criar usuário',
    description: 'Cria um novo usuário no sistema',
  })
  @ApiResponse({ status: 201, description: 'Usuário criado com sucesso' })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @ApiResponse({ status: 409, description: 'E-mail já cadastrado' })
  async create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Perfil do usuário autenticado',
    description: 'Retorna os dados do usuário logado via JWT.',
  })
  @ApiResponse({ status: 200, description: 'Perfil retornado com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token inválido ou ausente.' })
  getProfile(@Request() req) {
    return {
      message: 'Acesso autorizado!',
      userLoggedIn: req.user,
    };
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Listar todos os usuários',
    description: 'Acesso restrito a usuários com role **manager**.',
  })
  @ApiResponse({ status: 200, description: 'Lista de usuários retornada.' })
  @ApiResponse({ status: 403, description: 'Sem permissão de acesso.' })
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar usuário por ID' })
  @ApiParam({
    name: 'id',
    description: 'UUID do usuário',
    example: 'a3f1c2d4-e5b6-7890-abcd-ef1234567890',
  })
  @ApiResponse({ status: 200, description: 'Usuário encontrado.' })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado.' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Atualizar usuário',
    description: 'Apenas o próprio usuário ou um admin pode atualizar.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do usuário',
    example: 'a3f1c2d4-...',
  })
  @ApiResponse({ status: 200, description: 'Usuário atualizado com sucesso.' })
  @ApiResponse({
    status: 403,
    description: 'Sem permissão para alterar este usuário.',
  })
  update(
    @Request() req,
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    if (req.user.id !== id && !req.user.roles?.includes('admin')) {
      throw new ForbiddenException(
        'Você não tem permissão para alterar este usuário.',
      );
    }
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @ApiResponse({ status: 204, description: 'Usuário removido' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Remover usuário',
    description: 'Apenas o próprio usuário ou um admin pode remover.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do usuário',
    example: 'a3f1c2d4-...',
  })
  @ApiResponse({ status: 200, description: 'Usuário removido com sucesso.' })
  @ApiResponse({
    status: 403,
    description: 'Sem permissão para excluir este usuário.',
  })
  remove(@Request() req, @Param('id') id: string) {
    if (req.user.id !== id && !req.user.roles?.includes('admin')) {
      throw new ForbiddenException(
        'Você não tem permissão para excluir este usuário.',
      );
    }
    return this.usersService.remove(id);
  }

  @Post(':id/append-client')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({
    summary: 'Adiciona um perfil de cliente para um usuário específico',
    description:
      'Rota pública para vincular perfil de cliente a um ID de usuário existente.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do usuário',
    example: 'uuid-aqui',
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
  async append_client(@Param('id') id: string) {
    return this.usersService.appendClient(id);
  }

  @Post(':id/append-professional')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({
    summary: 'Adiciona um perfil de profissional para um usuário específico',
    description:
      'Rota pública para vincular perfil de profissional a um ID de usuário existente.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do usuário',
    example: 'uuid-aqui',
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
  async append_professional(@Param('id') id: string) {
    return this.usersService.appendProfessional(id);
  }

  @Post(':id/append-manager')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({
    summary: 'Adiciona um perfil de gerente para um usuário específico',
    description:
      'Rota pública para vincular perfil de gerente a um ID de usuário existente.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do usuário',
    example: 'uuid-aqui',
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
  async append_manager(@Param('id') id: string) {
    return this.usersService.appendManager(id);
  }

  @Patch(':id/promote-to-admin')
  async promoteToAdmin(@Param('id') id: string) {
    return await this.usersService.become_admin(id);
  }
}
