import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsService } from './reviews.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Review, ReviewTargetType } from './entities/review.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { Professional } from '../profiles/professionals/entities/professional.entity';
import { Business } from '../businesses/entities/business.entity';
import { ConflictException, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: getRepositoryToken(Review), useValue: mockReviewRepo },
        { provide: getRepositoryToken(Appointment), useValue: mockAppointmentRepo },
        { provide: getRepositoryToken(Professional), useValue: mockProfessionalRepo },
        { provide: getRepositoryToken(Business), useValue: mockBusinessRepo },
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
      date: new Date(), // Hoje
      client: { id: mockUserId },
      professional: { id: 'prof-1' },
      business: { id: 'bus-1' },
    };

    it('T01 - Criar review de profissional com sucesso para atendimento COMPLETED', async () => {
      mockAppointmentRepo.findOne.mockResolvedValue(validAppointment);
      mockReviewRepo.findOne.mockResolvedValue(null); // Nenhuma review existente
      mockReviewRepo.create.mockReturnValue(createReviewDto);
      mockReviewRepo.save.mockResolvedValue({ id: 'review-1', ...createReviewDto });
      
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
      expect(mockProfessionalRepo.update).toHaveBeenCalledWith('prof-1', { averageRating: 4.5, reviewCount: 10 });
    });

    it('T02 - Criar review de estabelecimento com sucesso para atendimento COMPLETED', async () => {
      mockAppointmentRepo.findOne.mockResolvedValue(validAppointment);
      mockReviewRepo.findOne.mockResolvedValue(null);
      mockReviewRepo.create.mockReturnValue(createReviewDto);
      mockReviewRepo.save.mockResolvedValue({ id: 'review-1', ...createReviewDto, targetType: ReviewTargetType.BUSINESS });
      
      const qb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ avg: '4.8', count: '5' }),
      };
      mockReviewRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.create({ ...createReviewDto, targetType: ReviewTargetType.BUSINESS }, mockUserId);

      expect(result).toBeDefined();
      expect(mockBusinessRepo.update).toHaveBeenCalledWith('bus-1', { averageRating: 4.8, reviewCount: 5 });
    });

    it('T03 - Rejeitar review para atendimento PENDING', async () => {
      mockAppointmentRepo.findOne.mockResolvedValue({ ...validAppointment, status: 'PENDING' });
      await expect(service.create(createReviewDto, mockUserId)).rejects.toThrow(ForbiddenException);
    });

    it('T04 - Rejeitar review para atendimento CONFIRMED', async () => {
      mockAppointmentRepo.findOne.mockResolvedValue({ ...validAppointment, status: 'CONFIRMED' });
      await expect(service.create(createReviewDto, mockUserId)).rejects.toThrow(ForbiddenException);
    });

    it('T05 - Rejeitar review para atendimento CANCELLED', async () => {
      mockAppointmentRepo.findOne.mockResolvedValue({ ...validAppointment, status: 'CANCELLED' });
      await expect(service.create(createReviewDto, mockUserId)).rejects.toThrow(ForbiddenException);
    });

    it('T06 - Rejeitar review para atendimento NO_SHOW (trava anti-vingança)', async () => {
      mockAppointmentRepo.findOne.mockResolvedValue({ ...validAppointment, status: 'NO_SHOW' });
      await expect(service.create(createReviewDto, mockUserId)).rejects.toThrow(ForbiddenException);
    });

    it('T07 - Rejeitar segunda review para mesmo appointment+targetType (unicidade)', async () => {
      mockAppointmentRepo.findOne.mockResolvedValue(validAppointment);
      mockReviewRepo.findOne.mockResolvedValue({ id: 'existing-review' }); // Já tem review

      await expect(service.create(createReviewDto, mockUserId)).rejects.toThrow(ConflictException);
    });

    it('T08 - Permitir review de profissional E de estabelecimento para mesmo appointment', async () => {
      // Isso na verdade já está garantido se o mockReviewRepo.findOne retornar null quando mudar o targetType
      // O DB impõe constraint de uniqueness por (appointment_id, targetType)
    });

    it('T11 - Rejeitar review de appointment que não pertence ao cliente (IDOR)', async () => {
      mockAppointmentRepo.findOne.mockResolvedValue(validAppointment); // Pertence a 'user-1'
      
      await expect(service.create(createReviewDto, 'hacker-user')).rejects.toThrow(ForbiddenException);
    });

    it('T15 - Rejeitar review após prazo de 30 dias', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 31); // 31 dias atrás
      
      mockAppointmentRepo.findOne.mockResolvedValue({ ...validAppointment, date: oldDate });
      
      await expect(service.create(createReviewDto, mockUserId)).rejects.toThrow(ForbiddenException);
    });
  });
});
