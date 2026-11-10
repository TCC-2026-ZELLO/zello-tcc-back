import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let service: any;

  beforeEach(async () => {
    service = {
      create: jest.fn().mockResolvedValue({ id: 'u1' }),
      findAll: jest.fn().mockResolvedValue([{ id: 'u1' }]),
      findOne: jest.fn().mockResolvedValue({ id: 'u1' }),
      update: jest.fn().mockResolvedValue({ id: 'u1' }),
      remove: jest.fn().mockResolvedValue({ message: 'ok' }),
      appendClient: jest.fn().mockResolvedValue({ id: 'c1' }),
      appendProfessional: jest.fn().mockResolvedValue({ id: 'p1' }),
      appendManager: jest.fn().mockResolvedValue({ id: 'm1' }),
      become_admin: jest.fn().mockResolvedValue({ id: 'u1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('deve ser definido e executar create, getProfile, findAll, findOne', async () => {
    expect(controller).toBeDefined();
    expect(await controller.create({} as any)).toEqual({ id: 'u1' });
    expect(controller.getProfile({ user: { id: 'u1' } })).toEqual({
      message: 'Acesso autorizado!',
      userLoggedIn: { id: 'u1' },
    });
    expect(await controller.findAll()).toEqual([{ id: 'u1' }]);
    expect(await controller.findOne('u1')).toEqual({ id: 'u1' });
  });

  it('deve permitir update pelo próprio usuário ou admin e bloquear terceiros', async () => {
    expect(() =>
      controller.update({ user: { id: 'u2', roles: ['client'] } }, 'u1', {}),
    ).toThrow(ForbiddenException);

    expect(
      await controller.update({ user: { id: 'u1', roles: [] } }, 'u1', {}),
    ).toEqual({ id: 'u1' });

    expect(
      await controller.update(
        { user: { id: 'u2', roles: ['admin'] } },
        'u1',
        {},
      ),
    ).toEqual({ id: 'u1' });
  });

  it('deve permitir remove pelo próprio usuário ou admin e bloquear terceiros', async () => {
    expect(() =>
      controller.remove({ user: { id: 'u2', roles: ['client'] } }, 'u1'),
    ).toThrow(ForbiddenException);

    expect(
      await controller.remove({ user: { id: 'u1', roles: [] } }, 'u1'),
    ).toEqual({ message: 'ok' });

    expect(
      await controller.remove({ user: { id: 'u2', roles: ['admin'] } }, 'u1'),
    ).toEqual({ message: 'ok' });
  });

  it('deve executar append_client, append_professional, append_manager e promoteToAdmin', async () => {
    expect(await controller.append_client('u1')).toEqual({ id: 'c1' });
    expect(await controller.append_professional('u1')).toEqual({ id: 'p1' });
    expect(await controller.append_manager('u1')).toEqual({ id: 'm1' });
    expect(await controller.promoteToAdmin('u1')).toEqual({ id: 'u1' });
  });
});
