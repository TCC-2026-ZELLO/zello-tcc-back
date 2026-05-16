import { Test, TestingModule } from '@nestjs/testing';
import { BusinessProfessionalsController } from './business-professionals.controller';
import { BusinessProfessionalsService } from './business-professionals.service';

describe('BusinessProfessionalsController', () => {
  let controller: BusinessProfessionalsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BusinessProfessionalsController],
      providers: [BusinessProfessionalsService],
    }).compile();

    controller = module.get<BusinessProfessionalsController>(BusinessProfessionalsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
