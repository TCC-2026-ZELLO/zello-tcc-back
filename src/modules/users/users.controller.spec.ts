import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UsersController } from './users.controller';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';

describe('UsersController', () => {
  let controller: UsersController;
  let service: any;
  let securityEvents: any;

  const self = { user: { id: 'u1', roles: ['client'], sessionId: 's1' } };
  const other = { user: { id: 'u2', roles: ['manager'] } };
  const admin = { user: { id: 'adm', roles: ['admin'] } };

  beforeEach(() => {
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
      revokeSessions: jest.fn().mockResolvedValue({ revoked: 2 }),
      setActive: jest.fn().mockResolvedValue({ id: 'u1', isActive: false }),
    };
    securityEvents = { log: jest.fn() };
    controller = new UsersController(service, securityEvents);
  });

  it('deve executar create, getProfile e findAll', async () => {
    expect(await controller.create({} as any)).toEqual({ id: 'u1' });
    expect(controller.getProfile({ user: { id: 'u1' } })).toEqual({
      message: 'Acesso autorizado!',
      userLoggedIn: { id: 'u1' },
    });
    expect(await controller.findAll()).toEqual([{ id: 'u1' }]);
  });

  it('findOne só devolve a própria conta ou qualquer conta para admin (v5.0.0-8.2.2)', async () => {
    expect(() => controller.findOne(other, 'u1')).toThrow(ForbiddenException);
    expect(await controller.findOne(self, 'u1')).toEqual({ id: 'u1' });
    expect(await controller.findOne(admin, 'u1')).toEqual({ id: 'u1' });
  });

  it('deve permitir update pelo próprio usuário ou admin e bloquear terceiros', async () => {
    await expect(controller.update(other, 'u1', {})).rejects.toThrow(
      ForbiddenException,
    );
    expect(service.update).not.toHaveBeenCalled();

    expect(
      await controller.update(self, 'u1', {
        password: 'frase bem comprida',
        currentPassword: 'atual',
      }),
    ).toEqual({ id: 'u1' });
    // A sessão atual é informada ao serviço para ser preservada na revogação.
    expect(service.update).toHaveBeenCalledWith(
      'u1',
      expect.anything(),
      expect.objectContaining({
        requesterId: 'u1',
        requesterIsAdmin: false,
        currentSessionId: 's1',
      }),
    );
    expect(securityEvents.log).toHaveBeenCalledWith('password_changed', self, {
      targetUserId: 'u1',
    });

    expect(await controller.update(admin, 'u1', {})).toEqual({ id: 'u1' });
  });

  it('deve permitir remove pelo próprio usuário ou admin e bloquear terceiros', async () => {
    expect(() => controller.remove(other, 'u1')).toThrow(ForbiddenException);
    expect(await controller.remove(self, 'u1')).toEqual({ message: 'ok' });
    expect(await controller.remove(admin, 'u1')).toEqual({ message: 'ok' });
  });

  it('não deve permitir acrescentar perfis à conta de outro usuário', async () => {
    await expect(controller.append_client(other, 'u1')).rejects.toThrow(
      ForbiddenException,
    );
    await expect(controller.append_professional(other, 'u1')).rejects.toThrow(
      ForbiddenException,
    );
    await expect(controller.append_manager(other, 'u1')).rejects.toThrow(
      ForbiddenException,
    );
    expect(service.appendManager).not.toHaveBeenCalled();

    expect(await controller.append_client(self, 'u1')).toEqual({ id: 'c1' });
    expect(await controller.append_professional(self, 'u1')).toEqual({
      id: 'p1',
    });
    expect(await controller.append_manager(admin, 'u1')).toEqual({ id: 'm1' });
  });

  it('appendOwnProfile sempre atua sobre a conta autenticada', async () => {
    await controller.appendOwnProfile(self, 'client');
    await controller.appendOwnProfile(self, 'professional');
    await controller.appendOwnProfile(self, 'manager');
    expect(service.appendClient).toHaveBeenCalledWith('u1');
    expect(service.appendProfessional).toHaveBeenCalledWith('u1');
    expect(service.appendManager).toHaveBeenCalledWith('u1');
    await expect(controller.appendOwnProfile(self, 'admin')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rotas administrativas exigem o papel admin na camada de guard (v5.0.0-8.2.1)', () => {
    const reflector = new Reflector();
    const rolesOf = (method: keyof UsersController) =>
      reflector.get<string[]>(ROLES_KEY, controller[method] as any);

    expect(rolesOf('promoteToAdmin')).toEqual(['admin']);
    expect(rolesOf('terminateSessions')).toEqual(['admin']);
    expect(rolesOf('updateStatus')).toEqual(['admin']);
    expect(rolesOf('findAll')).toEqual(['admin']);

    const guards = (method: keyof UsersController) =>
      (Reflect.getMetadata('__guards__', controller[method]) ?? []).map(
        (guard: { name: string }) => guard.name,
      );
    expect(guards('promoteToAdmin')).toEqual(['JwtAuthGuard', 'RolesGuard']);
    expect(guards('findOne')).toEqual(['JwtAuthGuard']);
  });

  it('admin promove, encerra sessões e desativa contas, com registro de auditoria', async () => {
    expect(await controller.promoteToAdmin(admin, 'u1')).toEqual({ id: 'u1' });
    expect(await controller.terminateSessions(admin, 'u1')).toEqual({
      message: 'Sessões encerradas.',
      revoked: 2,
    });
    expect(service.revokeSessions).toHaveBeenCalledWith('u1');
    expect(await controller.updateStatus(admin, 'u1', { isActive: false })).toEqual(
      { id: 'u1', isActive: false },
    );
    expect(securityEvents.log).toHaveBeenCalledWith(
      'sessions_revoked',
      admin,
      expect.objectContaining({ targetUserId: 'u1' }),
    );
  });
});
