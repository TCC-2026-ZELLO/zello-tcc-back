import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

describe('ReviewsController', () => {
  let controller: ReviewsController;
  let service: any;

  beforeEach(async () => {
    service = {
      create: jest.fn().mockResolvedValue({ id: 'r1' }),
      findByProfessional: jest.fn().mockResolvedValue([]),
      findByBusiness: jest.fn().mockResolvedValue([]),
      findByAppointment: jest.fn().mockResolvedValue([]),
      findSentByClient: jest.fn().mockResolvedValue([]),
      findReceivedByProfessional: jest.fn().mockResolvedValue([]),
      findReceivedByBusiness: jest.fn().mockResolvedValue([]),
      respondToReview: jest.fn().mockResolvedValue({ id: 'r1' }),
      updateReviewResponse: jest.fn().mockResolvedValue({ id: 'r1' }),
      removeReviewResponse: jest.fn().mockResolvedValue({ id: 'r1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReviewsController],
      providers: [{ provide: ReviewsService, useValue: service }],
    }).compile();

    controller = module.get<ReviewsController>(ReviewsController);
  });

  it('should be defined and delegate all endpoints', async () => {
    const req = {
      user: {
        id: 'u1',
        email: 'a@b.com',
        roles: ['client', 'professional', 'manager'],
        professional: { id: 'p1' },
      },
    };

    expect(await controller.create({} as any, req)).toEqual({ id: 'r1' });
    expect(await controller.findByProfessional('p1')).toEqual([]);
    expect(await controller.findByBusiness('b1')).toEqual([]);
    expect(await controller.findByAppointment('a1', req)).toEqual([]);
    expect(await controller.findSentByClient(req)).toEqual([]);
    expect(await controller.findReceivedByProfessional(req)).toEqual([]);
    expect(await controller.findReceivedByBusiness('b1', req)).toEqual([]);
    expect(await controller.respond('r1', { text: 'ok' }, req)).toEqual({
      id: 'r1',
    });
    expect(await controller.updateResponse('r1', { text: 'ok2' }, req)).toEqual(
      { id: 'r1' },
    );
    expect(await controller.removeResponse('r1', req)).toEqual({ id: 'r1' });
  });
});
