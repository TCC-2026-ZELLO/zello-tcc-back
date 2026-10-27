import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  ValidationPipe,
  UsePipes,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { CreateReviewResponseDto } from './dto/create-review-response.dto';
import { UpdateReviewResponseDto } from './dto/update-review-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ActiveUser } from '../auth/interfaces/active-user.interface';

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('client')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @ApiOperation({
    summary: 'Publicar avaliação de um atendimento concluído (Cliente)',
    description:
      'Permite ao cliente avaliar um atendimento com status COMPLETED, atribuindo nota de 1 a 5 estrelas e comentário direcionado ao profissional (PROFESSIONAL) ou ao estabelecimento (BUSINESS).',
  })
  @ApiBody({ type: CreateReviewDto })
  @ApiResponse({
    status: 201,
    description: 'Avaliação registrada com sucesso.',
    schema: {
      example: {
        id: 'd9b2d63d-a233-4123-847a-7c8399a1b2c3',
        appointmentId: 'c4a760a8-dbcf-4e14-9f39-6a8f1d2e3b4c',
        rating: 5,
        comment:
          'Atendimento impecável! O corte ficou exatamente como eu pedi, o profissional foi super pontual e o ambiente é muito agradável.',
        targetType: 'PROFESSIONAL',
        createdAt: '2026-11-15T18:00:00.000Z',
      },
    },
  })
  create(@Body() createReviewDto: CreateReviewDto, @Request() req) {
    return this.reviewsService.create(createReviewDto, req.user.id);
  }

  @Get('professional/:id')
  @ApiOperation({
    summary: 'Listar avaliações públicas de um profissional',
    description:
      'Retorna todas as avaliações recebidas por um profissional específico, acompanhadas da nota média e das respectivas respostas.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do perfil profissional',
    example: '3b241101-e2bb-4255-8caf-4136c566a962',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de avaliações do profissional retornada com sucesso.',
  })
  findByProfessional(@Param('id') professionalId: string) {
    return this.reviewsService.findByProfessional(professionalId);
  }

  @Get('business/:id')
  @ApiOperation({
    summary: 'Listar avaliações públicas de um estabelecimento',
    description:
      'Retorna todas as avaliações direcionadas a um estabelecimento específico, incluindo nota média geral e respostas da gerência.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do estabelecimento',
    example: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de avaliações do estabelecimento retornada com sucesso.',
  })
  findByBusiness(@Param('id') businessId: string) {
    return this.reviewsService.findByBusiness(businessId);
  }

  @Get('appointment/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Consultar avaliações vinculadas a um agendamento específico',
    description:
      'Retorna as avaliações já realizadas pelo cliente para um determinado agendamento (profissional e/ou estabelecimento).',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do agendamento',
    example: 'c4a760a8-dbcf-4e14-9f39-6a8f1d2e3b4c',
  })
  @ApiResponse({
    status: 200,
    description: 'Avaliações do agendamento retornadas com sucesso.',
  })
  findByAppointment(@Param('id') appointmentId: string, @Request() req) {
    return this.reviewsService.findByAppointment(appointmentId, req.user.id);
  }

  @Get('me/sent')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('client')
  @ApiOperation({
    summary: 'Listar avaliações enviadas pelo cliente logado',
    description:
      'Retorna o histórico de todas as avaliações publicadas pelo cliente autenticado.',
  })
  @ApiResponse({
    status: 200,
    description: 'Histórico de avaliações enviadas retornado com sucesso.',
  })
  findSentByClient(@Request() req) {
    return this.reviewsService.findSentByClient(req.user.id);
  }

  @Get('me/received')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('professional')
  @ApiOperation({
    summary: 'Listar avaliações recebidas pelo profissional logado',
    description:
      'Retorna todas as avaliações recebidas pelo especialista autenticado para acompanhamento e resposta.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de avaliações recebidas retornada com sucesso.',
  })
  findReceivedByProfessional(@Request() req) {
    return this.reviewsService.findReceivedByProfessional(
      req.user.professional.id,
    );
  }

  @Get('business/:id/received')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager')
  @ApiOperation({
    summary: 'Listar avaliações recebidas por um estabelecimento (Gestor)',
    description:
      'Retorna todas as avaliações recebidas pelo estabelecimento gerenciado para moderação e resposta oficial.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do estabelecimento',
    example: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  })
  @ApiResponse({
    status: 200,
    description: 'Avaliações recebidas pela empresa retornadas com sucesso.',
  })
  findReceivedByBusiness(@Param('id') businessId: string, @Request() req) {
    return this.reviewsService.findReceivedByBusiness(businessId);
  }

  @Post(':id/response')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('professional', 'manager')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @ApiOperation({
    summary: 'Responder a uma avaliação de cliente (Profissional ou Gestor)',
    description:
      'Publica uma resposta oficial vinculada a uma avaliação recebida pelo profissional ou pelo estabelecimento.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID da avaliação',
    example: 'd9b2d63d-a233-4123-847a-7c8399a1b2c3',
  })
  @ApiBody({ type: CreateReviewResponseDto })
  @ApiResponse({
    status: 201,
    description: 'Resposta à avaliação publicada com sucesso.',
  })
  respond(
    @Param('id') reviewId: string,
    @Body() dto: CreateReviewResponseDto,
    @Request() req: { user: ActiveUser },
  ) {
    return this.reviewsService.respondToReview(reviewId, dto, req.user);
  }

  @Patch(':id/response')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('professional', 'manager')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @ApiOperation({
    summary: 'Editar resposta de uma avaliação (Profissional ou Gestor)',
    description:
      'Atualiza o texto da resposta oficial publicada anteriormente em uma avaliação.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID da avaliação',
    example: 'd9b2d63d-a233-4123-847a-7c8399a1b2c3',
  })
  @ApiBody({ type: UpdateReviewResponseDto })
  @ApiResponse({
    status: 200,
    description: 'Resposta da avaliação atualizada com sucesso.',
  })
  updateResponse(
    @Param('id') reviewId: string,
    @Body() dto: UpdateReviewResponseDto,
    @Request() req: { user: ActiveUser },
  ) {
    return this.reviewsService.updateReviewResponse(reviewId, dto, req.user);
  }

  @Delete(':id/response')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager')
  @ApiOperation({
    summary: 'Remover resposta de uma avaliação (Gestor)',
    description:
      'Exclui a resposta oficial associada a uma avaliação. Acesso restrito a gestores.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID da avaliação',
    example: 'd9b2d63d-a233-4123-847a-7c8399a1b2c3',
  })
  @ApiResponse({
    status: 200,
    description: 'Resposta removida com sucesso.',
  })
  removeResponse(
    @Param('id') reviewId: string,
    @Request() req: { user: ActiveUser },
  ) {
    return this.reviewsService.removeReviewResponse(reviewId, req.user);
  }
}
