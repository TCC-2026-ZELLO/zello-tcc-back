import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BusinessViewsService } from './business-views.service';
import { DASHBOARD_TOKENS } from './constants/dashboard.tokens';

describe('BusinessViewsService', () => {
  let service: BusinessViewsService;
  const businessViewRepository = {
    businessExists: jest.fn(),
    registerView: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessViewsService,
        {
          provide: DASHBOARD_TOKENS.businessViewRepository,
          useValue: businessViewRepository,
        },
      ],
    }).compile();

    service = module.get(BusinessViewsService);
  });

  it('registra a visualização quando o estabelecimento existe', async () => {
    businessViewRepository.businessExists.mockResolvedValue(true);
    businessViewRepository.registerView.mockResolvedValue(false);

    await expect(service.registerView('b1', 'u1')).resolves.toBeUndefined();
    expect(businessViewRepository.registerView).toHaveBeenCalledWith(
      'b1',
      'u1',
    );
  });

  it('lança 404 quando o estabelecimento não existe', async () => {
    businessViewRepository.businessExists.mockResolvedValue(false);

    await expect(service.registerView('b1', 'u1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(businessViewRepository.registerView).not.toHaveBeenCalled();
  });
});
