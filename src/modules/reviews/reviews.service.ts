import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review, ReviewTargetType } from './entities/review.entity';
import { CreateReviewDto } from './dto/create-review.dto';
import { Appointment, AppointmentStatus } from '../appointments/entities/appointment.entity';
import { Professional } from '../profiles/professionals/entities/professional.entity';
import { Business } from '../businesses/entities/business.entity';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewRepo: Repository<Review>,
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
    @InjectRepository(Professional)
    private readonly professionalRepo: Repository<Professional>,
    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,
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
      relations: ['client'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByBusiness(businessId: string): Promise<Review[]> {
    return this.reviewRepo.find({
      where: { business: { id: businessId }, targetType: ReviewTargetType.BUSINESS },
      relations: ['client'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByAppointment(appointmentId: string, userId: string): Promise<Review[]> {
    return this.reviewRepo.find({
      where: { appointment: { id: appointmentId }, client: { id: userId } },
    });
  }

  async findSentByClient(userId: string): Promise<Review[]> {
    return this.reviewRepo.find({
      where: { client: { id: userId } },
      relations: ['professional', 'business', 'professional.user'],
      order: { createdAt: 'DESC' },
    });
  }

  async findReceivedByProfessional(professionalId: string): Promise<Review[]> {
    return this.reviewRepo.find({
      where: { professional: { id: professionalId }, targetType: ReviewTargetType.PROFESSIONAL },
      relations: ['client', 'appointment'],
      order: { createdAt: 'DESC' },
    });
  }

  async findReceivedByBusiness(businessId: string): Promise<Review[]> {
    return this.reviewRepo.find({
      where: { business: { id: businessId }, targetType: ReviewTargetType.BUSINESS },
      relations: ['client', 'appointment'],
      order: { createdAt: 'DESC' },
    });
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
