import { Test, TestingModule } from '@nestjs/testing';
import { BusinessManagersService } from './business-managers.service';

describe('BusinessManagersService', () => {
  let service: BusinessManagersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BusinessManagersService],
    }).compile();

    service = module.get<BusinessManagersService>(BusinessManagersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
