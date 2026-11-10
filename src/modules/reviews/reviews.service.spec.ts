import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsService } from './reviews.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Review, ReviewTargetType } from './entities/review.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { Professional } from '../profiles/professionals/entities/professional.entity';
import { Business } from '../businesses/entities/business.entity';
import { Manager } from '../profiles/managers/entities/manager.entity';
import { BusinessManager } from '../business-managers/entities/business-manager.entity';
import { MailerService } from '@nestjs-modules/mailer';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

describe('ReviewsService', () => {
  let service: ReviewsService;

  const mockReviewRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockAppointmentRepo = {
    findOne: jest.fn(),
  };

  const mockProfessionalRepo = {
    update: jest.fn(),
  };

  const mockBusinessRepo = {
    update: jest.fn(),
  };

  const mockManagerRepo = {
    findOne: jest.fn(),
  };

  const mockBmRepo = {
    findOne: jest.fn(),
  };

  const mockMailerService = {
    sendMail: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: getRepositoryToken(Review), useValue: mockReviewRepo },
        {
          provide: getRepositoryToken(Appointment),
          useValue: mockAppointmentRepo,
        },
        {
          provide: getRepositoryToken(Professional),
          useValue: mockProfessionalRepo,
        },
        { provide: getRepositoryToken(Business), useValue: mockBusinessRepo },
        { provide: getRepositoryToken(Manager), useValue: mockManagerRepo },
        {
          provide: getRepositoryToken(BusinessManager),
          useValue: mockBmRepo,
        },
        { provide: MailerService, useValue: mockMailerService },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const mockUserId = 'user-1';
    const createReviewDto = {
      appointmentId: 'appt-1',
      rating: 5,
      comment: 'Excelente serviço',
      targetType: ReviewTargetType.PROFESSIONAL,
    };

    const validAppointment = {
      id: 'appt-1',
      status: 'COMPLETED',
      date: new Date(),
      client: { id: mockUserId },
      professional: { id: 'prof-1' },
      business: { id: 'bus-1' },
    };

    it('T01 - Criar review de profissional com sucesso para atendimento COMPLETED', async () => {
      mockAppointmentRepo.findOne.mockResolvedValue(validAppointment);
      mockReviewRepo.findOne.mockResolvedValue(null);
      mockReviewRepo.create.mockReturnValue(createReviewDto);
      mockReviewRepo.save.mockResolvedValue({
        id: 'review-1',
        ...createReviewDto,
      });

      const qb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ avg: '4.5', count: '10' }),
      };
      mockReviewRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.create(createReviewDto, mockUserId);

      expect(result).toBeDefined();
      expect(mockReviewRepo.save).toHaveBeenCalled();
      expect(mockProfessionalRepo.update).toHaveBeenCalledWith('prof-1', {
        averageRating: 4.5,
        reviewCount: 10,
      });
    });

    it('T02 - Criar review de estabelecimento com sucesso para atendimento COMPLETED', async () => {
      mockAppointmentRepo.findOne.mockResolvedValue(validAppointment);
      mockReviewRepo.findOne.mockResolvedValue(null);
      mockReviewRepo.create.mockReturnValue(createReviewDto);
      mockReviewRepo.save.mockResolvedValue({
        id: 'review-1',
        ...createReviewDto,
        targetType: ReviewTargetType.BUSINESS,
      });

      const qb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ avg: '4.8', count: '5' }),
      };
      mockReviewRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.create(
        { ...createReviewDto, targetType: ReviewTargetType.BUSINESS },
        mockUserId,
      );

      expect(result).toBeDefined();
      expect(mockBusinessRepo.update).toHaveBeenCalledWith('bus-1', {
        averageRating: 4.8,
        reviewCount: 5,
      });
    });

    it('T03..T15 - Rejeitar estados inválidos, duplicados, IDOR e prazo expirado', async () => {
      mockAppointmentRepo.findOne.mockResolvedValue(null);
      await expect(service.create(createReviewDto, mockUserId)).rejects.toThrow(
        NotFoundException,
      );

      mockAppointmentRepo.findOne.mockResolvedValue({
        ...validAppointment,
        status: 'PENDING',
      });
      await expect(service.create(createReviewDto, mockUserId)).rejects.toThrow(
        ForbiddenException,
      );

      mockAppointmentRepo.findOne.mockResolvedValue(validAppointment);
      await expect(
        service.create(createReviewDto, 'hacker-user'),
      ).rejects.toThrow(ForbiddenException);

      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 31);
      mockAppointmentRepo.findOne.mockResolvedValue({
        ...validAppointment,
        date: oldDate,
      });
      await expect(service.create(createReviewDto, mockUserId)).rejects.toThrow(
        ForbiddenException,
      );

      mockAppointmentRepo.findOne.mockResolvedValue(validAppointment);
      mockReviewRepo.findOne.mockResolvedValue({ id: 'existing-review' });
      await expect(service.create(createReviewDto, mockUserId)).rejects.toThrow(
        ConflictException,
      );

      mockReviewRepo.findOne.mockResolvedValue(null);
      mockAppointmentRepo.findOne.mockResolvedValue({
        ...validAppointment,
        professional: null,
      });
      await expect(service.create(createReviewDto, mockUserId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('Queries and Review Responses', () => {
    const sampleReview = () => ({
      id: 'rev-1',
      comment: 'Ótimo!',
      responseText: null as string | null,
      client: { id: 'c1', name: 'Maria', email: 'maria@zello.com' },
      appointment: {
        business: { id: 'b1' },
        professional: { user: { id: 'pro-user-1', name: 'Carlos' } },
      },
    });

    it('should execute all findBy* methods', async () => {
      mockReviewRepo.find.mockResolvedValue([]);
      await service.findByProfessional('p1');
      await service.findByBusiness('b1');
      await service.findByAppointment('a1', 'u1');
      await service.findSentByClient('u1');
      await service.findReceivedByProfessional('p1');
      await service.findReceivedByBusiness('b1');
      expect(mockReviewRepo.find).toHaveBeenCalledTimes(6);
    });

    it('should respondToReview as owning professional and notify client', async () => {
      const rev = sampleReview();
      mockReviewRepo.findOne.mockResolvedValue(rev);
      mockReviewRepo.save.mockImplementation(async (r) => r);

      const res = await service.respondToReview(
        'rev-1',
        { text: 'Obrigado!' },
        { id: 'pro-user-1', email: 'p@zello.com', roles: ['professional'] },
      );

      expect(res.responseText).toBe('Obrigado!');
      expect(mockMailerService.sendMail).toHaveBeenCalled();
    });

    it('should respondToReview, updateReviewResponse, and removeReviewResponse as manager', async () => {
      const rev = sampleReview();
      mockReviewRepo.findOne.mockResolvedValue(rev);
      mockReviewRepo.save.mockImplementation(async (r) => r);
      mockManagerRepo.findOne.mockResolvedValue({ id: 'm1' });
      mockBmRepo.findOne.mockResolvedValue({ id: 'bm1' });

      const managerUser = {
        id: 'mgr-user',
        email: 'm@zello.com',
        roles: ['manager'],
      };

      await service.respondToReview('rev-1', { text: 'Valeu!' }, managerUser);

      // Update response
      await service.updateReviewResponse(
        'rev-1',
        { text: 'Valeu mesmo!' },
        managerUser,
      );
      expect(rev.responseText).toBe('Valeu mesmo!');

      // Remove response
      await service.removeReviewResponse('rev-1', managerUser);
      expect(rev.responseText).toBeNull();
    });

    it('should throw ForbiddenException, ConflictException, or NotFoundException on invalid response actions', async () => {
      mockReviewRepo.findOne.mockResolvedValue(null);
      await expect(
        service.respondToReview(
          'missing',
          { text: 'Oi' },
          { id: 'u1', email: 'a@b.com', roles: ['client'] },
        ),
      ).rejects.toThrow(NotFoundException);

      mockReviewRepo.findOne.mockResolvedValue(sampleReview());
      await expect(
        service.respondToReview(
          'rev-1',
          { text: 'Oi' },
          { id: 'u-other', email: 'a@b.com', roles: ['professional'] },
        ),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.removeReviewResponse('rev-1', {
          id: 'u1',
          email: 'a@b.com',
          roles: ['professional'],
        }),
      ).rejects.toThrow( NotFoundException );
    });
  });
});
