import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MailerService } from '@nestjs-modules/mailer';
import { Review, ReviewTargetType } from './entities/review.entity';
import { CreateReviewDto } from './dto/create-review.dto';
import { CreateReviewResponseDto } from './dto/create-review-response.dto';
import { UpdateReviewResponseDto } from './dto/update-review-response.dto';
import { Appointment, AppointmentStatus } from '../appointments/entities/appointment.entity';
import { Professional } from '../profiles/professionals/entities/professional.entity';
import { Business } from '../businesses/entities/business.entity';
import { Manager } from '../profiles/managers/entities/manager.entity';
import { BusinessManager } from '../business-managers/entities/business-manager.entity';
import { ActiveUser } from '../auth/interfaces/active-user.interface';

const REVIEW_RESPONSE_RELATIONS = [
  'client',
  'appointment',
  'appointment.business',
  'appointment.professional',
  'appointment.professional.user',
  'professional',
  'professional.user',
  'business',
  'responseAuthor',
];

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    @InjectRepository(Review)
    private readonly reviewRepo: Repository<Review>,
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
    @InjectRepository(Professional)
    private readonly professionalRepo: Repository<Professional>,
    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,
    @InjectRepository(Manager)
    private readonly managerRepo: Repository<Manager>,
    @InjectRepository(BusinessManager)
    private readonly bmRepo: Repository<BusinessManager>,
    private readonly mailerService: MailerService,
  ) {}

  async create(createReviewDto: CreateReviewDto, userId: string): Promise<Review> {
    const { appointmentId, rating, comment, targetType } = createReviewDto;

    const appointment = await this.appointmentRepo.findOne({
      where: { id: appointmentId },
      relations: ['client', 'professional', 'business'],
    });

    if (!appointment) {
      throw new NotFoundException('Agendamento não encontrado.');
    }

    // CA6 e IDOR: Verifica se o agendamento pertence ao usuário logado
    if (appointment.client.id !== userId) {
      throw new ForbiddenException('Você não tem permissão para avaliar este atendimento.');
    }

    // Apenas agendamentos finalizados podem ser avaliados
    if (appointment.status !== 'COMPLETED') {
      throw new ForbiddenException('Apenas atendimentos finalizados podem ser avaliados.');
    }

    // CA7: Prazo de 30 dias para avaliar
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const appointmentDate = new Date(appointment.date);
    if (appointmentDate < thirtyDaysAgo) {
      throw new ForbiddenException('Prazo de 30 dias para avaliação expirou.');
    }

    // CA5: Única avaliação por serviço e tipo
    const existingReview = await this.reviewRepo.findOne({
      where: { appointment: { id: appointmentId }, targetType },
    });

    if (existingReview) {
      throw new ConflictException(`Você já avaliou este ${targetType === ReviewTargetType.PROFESSIONAL ? 'profissional' : 'estabelecimento'} para este atendimento.`);
    }

    let professional: Professional | undefined;
    let business: Business | undefined;

    if (targetType === ReviewTargetType.PROFESSIONAL) {
      professional = appointment.professional;
      if (!professional) {
        throw new BadRequestException('Profissional não encontrado neste agendamento.');
      }
    } else {
      business = appointment.business;
      if (!business) {
        throw new BadRequestException('Estabelecimento não encontrado neste agendamento.');
      }
    }

    // Cria a avaliação
    const review = this.reviewRepo.create({
      rating,
      comment,
      targetType,
      appointment,
      client: { id: userId },
      professional,
      business,
    });

    const savedReview = await this.reviewRepo.save(review);

    // CA3: Recalcular média
    if (targetType === ReviewTargetType.PROFESSIONAL && professional) {
      await this.recalculateProfessionalAverage(professional.id);
    } else if (targetType === ReviewTargetType.BUSINESS && business) {
      await this.recalculateBusinessAverage(business.id);
    }

    return savedReview;
  }

  async findByProfessional(professionalId: string): Promise<Review[]> {
    return this.reviewRepo.find({
      where: { professional: { id: professionalId }, targetType: ReviewTargetType.PROFESSIONAL },
      relations: ['client', 'responseAuthor'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByBusiness(businessId: string): Promise<Review[]> {
    return this.reviewRepo.find({
      where: { business: { id: businessId }, targetType: ReviewTargetType.BUSINESS },
      relations: ['client', 'responseAuthor'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByAppointment(appointmentId: string, userId: string): Promise<Review[]> {
    return this.reviewRepo.find({
      where: { appointment: { id: appointmentId }, client: { id: userId } },
      relations: ['responseAuthor'],
    });
  }

  async findSentByClient(userId: string): Promise<Review[]> {
    return this.reviewRepo.find({
      where: { client: { id: userId } },
      relations: ['professional', 'business', 'professional.user', 'responseAuthor'],
      order: { createdAt: 'DESC' },
    });
  }

  async findReceivedByProfessional(professionalId: string): Promise<Review[]> {
    return this.reviewRepo.find({
      where: { professional: { id: professionalId }, targetType: ReviewTargetType.PROFESSIONAL },
      relations: ['client', 'appointment', 'responseAuthor'],
      order: { createdAt: 'DESC' },
    });
  }

  async findReceivedByBusiness(businessId: string): Promise<Review[]> {
    return this.reviewRepo.find({
      where: { business: { id: businessId }, targetType: ReviewTargetType.BUSINESS },
      relations: ['client', 'appointment', 'responseAuthor'],
      order: { createdAt: 'DESC' },
    });
  }

  async respondToReview(
    reviewId: string,
    dto: CreateReviewResponseDto,
    requester: ActiveUser,
  ): Promise<Review> {
    const review = await this.getReviewOrFail(reviewId);

    await this.assertCanRespondToReview(review, requester);

    if (review.responseText) {
      throw new ConflictException(
        'Esta avaliação já possui uma resposta. Utilize a edição para atualizá-la.',
      );
    }

    review.responseText = dto.text;
    review.responseAuthor = { id: requester.id } as any;
    review.respondedAt = new Date();
    review.responseUpdatedAt = null;

    const savedReview = await this.reviewRepo.save(review);

    // CA3: Notifica o cliente autor do comentário sobre o novo feedback.
    await this.notifyClientOfNewResponse(savedReview);

    return this.getReviewOrFail(reviewId);
  }

  /**
   * CA2 + CA4: Permite ao profissional/gestor corrigir uma resposta já enviada.
   */
  async updateReviewResponse(
    reviewId: string,
    dto: UpdateReviewResponseDto,
    requester: ActiveUser,
  ): Promise<Review> {
    const review = await this.getReviewOrFail(reviewId);

    await this.assertCanRespondToReview(review, requester);

    if (!review.responseText) {
      throw new NotFoundException(
        'Esta avaliação ainda não possui resposta para ser editada.',
      );
    }

    if (dto.text !== undefined) {
      review.responseText = dto.text;
    }
    review.responseUpdatedAt = new Date();

    await this.reviewRepo.save(review);

    return this.getReviewOrFail(reviewId);
  }

  async removeReviewResponse(
    reviewId: string,
    requester: ActiveUser,
  ): Promise<Review> {
    const review = await this.getReviewOrFail(reviewId);

    if (!review.responseText) {
      throw new NotFoundException('Esta avaliação não possui resposta para remover.');
    }

    await this.assertIsManagerOfReviewBusiness(review, requester);

    review.responseText = null;
    review.responseAuthor = null;
    review.respondedAt = null;
    review.responseUpdatedAt = null;

    await this.reviewRepo.save(review);

    return this.getReviewOrFail(reviewId);
  }

  private async getReviewOrFail(reviewId: string): Promise<Review> {
    const review = await this.reviewRepo.findOne({
      where: { id: reviewId },
      relations: REVIEW_RESPONSE_RELATIONS,
    });

    if (!review) {
      throw new NotFoundException('Avaliação não encontrada.');
    }

    return review;
  }

  /**
   * CA4 - Filtro de autoridade: apenas o prestador que realizou o serviço
   * avaliado, ou um Gestor vinculado ao estabelecimento, podem responder
   * (ou editar a resposta) de uma avaliação.
   */
  private async assertCanRespondToReview(
    review: Review,
    requester: ActiveUser,
  ): Promise<void> {
    const isOwningProfessional =
      requester.roles.includes('professional') &&
      review.appointment?.professional?.user?.id === requester.id;

    if (isOwningProfessional) {
      return;
    }

    if (requester.roles.includes('manager')) {
      const isManagerOfBusiness = await this.isManagerOfBusiness(
        requester.id,
        review.appointment?.business?.id,
      );

      if (isManagerOfBusiness) {
        return;
      }
    }

    throw new ForbiddenException(
      'Apenas o profissional que realizou o atendimento ou o gestor do estabelecimento podem responder a esta avaliação.',
    );
  }

  /** CA5 - Apenas o Gestor do estabelecimento pode excluir uma resposta. */
  private async assertIsManagerOfReviewBusiness(
    review: Review,
    requester: ActiveUser,
  ): Promise<void> {
    if (!requester.roles.includes('manager')) {
      throw new ForbiddenException(
        'Apenas o gestor do estabelecimento pode remover uma resposta.',
      );
    }

    const isManagerOfBusiness = await this.isManagerOfBusiness(
      requester.id,
      review.appointment?.business?.id,
    );

    if (!isManagerOfBusiness) {
      throw new ForbiddenException(
        'Apenas o gestor do estabelecimento pode remover uma resposta.',
      );
    }
  }

  private async isManagerOfBusiness(
    userId: string,
    businessId?: string,
  ): Promise<boolean> {
    if (!businessId) {
      return false;
    }

    const manager = await this.managerRepo.findOne({
      where: { user: { id: userId } },
    });

    if (!manager) {
      return false;
    }

    const link = await this.bmRepo.findOne({
      where: { manager: { id: manager.id }, business: { id: businessId } },
    });

    return !!link;
  }

  /** CA3 - Notifica por e-mail o cliente autor do comentário sobre a nova resposta. */
  private async notifyClientOfNewResponse(review: Review): Promise<void> {
    const client = review.client;

    if (!client?.email) {
      return;
    }

    const responderName =
      review.appointment?.professional?.user?.name || 'A equipe Zello';

    try {
      await this.mailerService.sendMail({
        to: client.email,
        subject: 'Você recebeu uma resposta à sua avaliação - Zello',
        html: `
        <div style="font-family: sans-serif; color: #333;">
          <h2>Sua avaliação recebeu uma resposta</h2>
          <p>Olá, ${client.name}.</p>
          <p>${responderName} respondeu ao comentário que você deixou no Zello.</p>
          <blockquote style="border-left: 3px solid #007bff; margin: 10px 0; padding-left: 10px; color: #555;">
            "${review.comment}"
          </blockquote>
          <p><strong>Resposta:</strong> ${review.responseText}</p>
          <p>Acesse o app para ver os detalhes.</p>
        </div>
      `,
      });
    } catch (error) {
      this.logger.error(
        `Falha ao notificar cliente ${client.id} sobre resposta da avaliação ${review.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async recalculateProfessionalAverage(professionalId: string): Promise<void> {
    const { avg, count } = await this.reviewRepo
      .createQueryBuilder('review')
      .select('AVG(review.rating)', 'avg')
      .addSelect('COUNT(review.id)', 'count')
      .where('review.professional_id = :professionalId', { professionalId })
      .andWhere('review.targetType = :targetType', { targetType: ReviewTargetType.PROFESSIONAL })
      .getRawOne();

    await this.professionalRepo.update(professionalId, {
      averageRating: avg ? Number(parseFloat(avg).toFixed(1)) : 5.0,
      reviewCount: Number(count) || 0,
    });
  }

  private async recalculateBusinessAverage(businessId: string): Promise<void> {
    const { avg, count } = await this.reviewRepo
      .createQueryBuilder('review')
      .select('AVG(review.rating)', 'avg')
      .addSelect('COUNT(review.id)', 'count')
      .where('review.business_id = :businessId', { businessId })
      .andWhere('review.targetType = :targetType', { targetType: ReviewTargetType.BUSINESS })
      .getRawOne();

    await this.businessRepo.update(businessId, {
      averageRating: avg ? Number(parseFloat(avg).toFixed(1)) : 5.0,
      reviewCount: Number(count) || 0,
    });
  }
}
