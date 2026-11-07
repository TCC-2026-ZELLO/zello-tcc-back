import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import { Repository } from 'typeorm';
import { ActiveUser } from '../../auth/interfaces/active-user.interface';
import { BusinessManager } from '../../business-managers/entities/business-manager.entity';
import { Manager } from '../../profiles/managers/entities/manager.entity';
import { DASHBOARD_MESSAGES } from '../constants/dashboard.constants';

interface BusinessScopedRequest {
  user?: ActiveUser;
  params: { businessId?: string };
}

/**
 * Garante que o usuário autenticado gerencia o estabelecimento da rota
 * (`:businessId`). Mesmo critério de AppointmentsService.validateManagerAuthority:
 * perfil Manager do usuário + vínculo em `manager_business`; caso contrário 403.
 *
 * Deve ser aplicado depois de JwtAuthGuard (depende de `request.user`).
 */
@Injectable()
export class ManagesBusinessGuard implements CanActivate {
  constructor(
    @InjectRepository(Manager)
    private readonly managerRepository: Repository<Manager>,
    @InjectRepository(BusinessManager)
    private readonly businessManagerRepository: Repository<BusinessManager>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<BusinessScopedRequest>();
    const userId = request.user?.id;
    const businessId = request.params.businessId;

    if (!userId) {
      throw new ForbiddenException(DASHBOARD_MESSAGES.managerProfileNotFound);
    }
    if (!businessId || !isUUID(businessId)) {
      throw new BadRequestException(DASHBOARD_MESSAGES.invalidBusinessId);
    }

    const manager = await this.managerRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!manager) {
      throw new ForbiddenException(DASHBOARD_MESSAGES.managerProfileNotFound);
    }

    const link = await this.businessManagerRepository.findOne({
      where: { manager: { id: manager.id }, business: { id: businessId } },
    });
    if (!link) {
      throw new ForbiddenException(DASHBOARD_MESSAGES.forbiddenBusiness);
    }

    return true;
  }
}
