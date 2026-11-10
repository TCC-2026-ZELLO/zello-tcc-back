import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { BusinessManager } from '../business-managers/entities/business-manager.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Manager } from '../profiles/managers/entities/manager.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { ManagesBusinessGuard } from './guards/manages-business.guard';

const BUSINESS_ID = '0d9e8a8e-6a43-4f43-9f0a-1c5f4f6b2a11';
const OTHER_BUSINESS_ID = '7b1f3c2a-1d2e-4c5b-8a9f-0e1d2c3b4a59';

function contextFor(userId: string | undefined, businessId: string) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        user: userId
          ? { id: userId, email: 'g@x.com', roles: ['manager'] }
          : undefined,
        params: { businessId },
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('DashboardController', () => {
  let controller: DashboardController;
  let guard: ManagesBusinessGuard;

  const dashboardService = { getBusinessDashboard: jest.fn() };
  const managerRepository = { findOne: jest.fn() };
  const businessManagerRepository = { findOne: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        { provide: DashboardService, useValue: dashboardService },
        ManagesBusinessGuard,
        { provide: getRepositoryToken(Manager), useValue: managerRepository },
        {
          provide: getRepositoryToken(BusinessManager),
          useValue: businessManagerRepository,
        },
      ],
    }).compile();

    controller = module.get(DashboardController);
    guard = module.get(ManagesBusinessGuard);
  });

  it('protege a rota com JWT, role manager e posse do estabelecimento', () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method -- só lê metadata do handler
    const handler = DashboardController.prototype.getBusinessDashboard;
    const guards = Reflect.getMetadata(GUARDS_METADATA, handler) as unknown[];
    const roles = new Reflector().get<string[]>(ROLES_KEY, handler);

    expect(guards).toEqual([JwtAuthGuard, RolesGuard, ManagesBusinessGuard]);
    expect(roles).toEqual(['manager']);
  });

  it('delega ao service com o businessId e a query', async () => {
    const payload = { period: {} };
    dashboardService.getBusinessDashboard.mockResolvedValue(payload);
    const query = { from: '2026-10-01', to: '2026-10-31' };

    await expect(
      controller.getBusinessDashboard(BUSINESS_ID, query),
    ).resolves.toBe(payload);
    expect(dashboardService.getBusinessDashboard).toHaveBeenCalledWith(
      BUSINESS_ID,
      query,
    );
  });

  describe('ManagesBusinessGuard', () => {
    it('permite o gestor vinculado ao estabelecimento', async () => {
      managerRepository.findOne.mockResolvedValue({ id: 'm1' });
      businessManagerRepository.findOne.mockResolvedValue({ id: 'link' });

      await expect(
        guard.canActivate(contextFor('u1', BUSINESS_ID)),
      ).resolves.toBe(true);
      expect(businessManagerRepository.findOne).toHaveBeenCalledWith({
        where: { manager: { id: 'm1' }, business: { id: BUSINESS_ID } },
      });
    });

    it('retorna 403 para gestor de outro estabelecimento', async () => {
      managerRepository.findOne.mockResolvedValue({ id: 'm1' });
      businessManagerRepository.findOne.mockResolvedValue(null);

      await expect(
        guard.canActivate(contextFor('u1', OTHER_BUSINESS_ID)),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('retorna 403 quando o usuário não tem perfil de gestor', async () => {
      managerRepository.findOne.mockResolvedValue(null);

      await expect(
        guard.canActivate(contextFor('u1', BUSINESS_ID)),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(businessManagerRepository.findOne).not.toHaveBeenCalled();
    });

    it('retorna 400 para businessId que não é UUID', async () => {
      await expect(
        guard.canActivate(contextFor('u1', 'nao-e-uuid')),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(managerRepository.findOne).not.toHaveBeenCalled();
    });
  });
});
