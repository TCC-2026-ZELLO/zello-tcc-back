import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';

describe('AppointmentsController', () => {
  let controller: AppointmentsController;

  const mockAppointmentsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findByClient: jest.fn(),
    findByBusiness: jest.fn(),
    updateStatus: jest.fn(),
    cancelClientAppointment: jest.fn(),
    markNoShow: jest.fn(),
    revertNoShow: jest.fn(),
    cancelJustified: jest.fn(),
    getClientReputation: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppointmentsController],
      providers: [
        {
          provide: AppointmentsService,
          useValue: mockAppointmentsService,
        },
      ],
    }).compile();

    controller = module.get<AppointmentsController>(AppointmentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
