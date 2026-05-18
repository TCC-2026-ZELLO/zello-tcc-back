import { Test, TestingModule } from '@nestjs/testing';
import { BusinessManagersController } from './business-managers.controller';
import { BusinessManagersService } from './business-managers.service';

describe('BusinessManagersController', () => {
  let controller: BusinessManagersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BusinessManagersController],
      providers: [BusinessManagersService],
    }).compile();

    controller = module.get<BusinessManagersController>(
      BusinessManagersController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
