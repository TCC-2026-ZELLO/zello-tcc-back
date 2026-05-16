import { Test, TestingModule } from '@nestjs/testing';
import { BusinessProfessionalsService } from './business-professionals.service';

describe('BusinessProfessionalsService', () => {
  let service: BusinessProfessionalsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BusinessProfessionalsService],
    }).compile();

    service = module.get<BusinessProfessionalsService>(BusinessProfessionalsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
