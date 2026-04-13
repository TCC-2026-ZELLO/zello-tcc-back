// Mocks de módulos com path absoluto (src/...) que o Jest não resolve
// fora do contexto da aplicação completa. Devem vir antes de qualquer import.
jest.mock('../../common/interceptors/log-interceptor', () => ({
  LoggersInterceptor: jest.fn().mockImplementation(() => ({
    intercept: jest.fn((ctx, next) => next.handle()),
  })),
}));

jest.mock('../../common/interceptors/success-interceptor', () => ({
  SucessInterceptor: jest.fn().mockImplementation(() => ({
    intercept: jest.fn((ctx, next) => next.handle()),
  })),
}));

jest.mock('../../common/decorators/roles.decorator', () => ({
  Roles: () => jest.fn(),
  ROLES_KEY: 'roles',
}));

import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
            updatePassword: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('deve ser definido', () => {
    expect(controller).toBeDefined();
  });
});
