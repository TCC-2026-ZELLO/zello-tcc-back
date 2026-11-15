import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessManager } from './entities/business-manager.entity';
import { CreateBusinessManagerDto } from './dto/create-business-manager.dto';
import { Manager } from '../profiles/managers/entities/manager.entity';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { TenantAccessService } from '../../common/security/tenant-access.service';

@Injectable()
export class BusinessManagersService {
  constructor(
    @InjectRepository(BusinessManager)
    private readonly bmRepo: Repository<BusinessManager>,
    @InjectRepository(Manager)
    private readonly managerRepo: Repository<Manager>,
    private readonly tenantAccess: TenantAccessService,
  ) {}

  /** Consulta de um vínculo restrita a admin ou gestor do mesmo estabelecimento (v5.0.0-8.4.1). */
  async findOneFor(id: string, requester: ActiveUser) {
    const link = await this.findOne(id);
    await this.tenantAccess.assertManagesBusiness(requester, link.business.id, {
      allowAdmin: true,
    });
    return link;
  }

  /** Lista de gestores de um estabelecimento, restrita a admin ou gestor dele. */
  async findByBusinessFor(businessId: string, requester: ActiveUser) {
    await this.tenantAccess.assertManagesBusiness(requester, businessId, {
      allowAdmin: true,
    });
    return this.findByBusiness(businessId);
  }

  async create(
    dto: CreateBusinessManagerDto,
    requester: ActiveUser,
  ): Promise<BusinessManager> {
    if (!requester.roles.includes('admin')) {
      const requesterManager = await this.managerRepo.findOne({
        where: { user: { id: requester.id } },
      });

      if (!requesterManager) {
        throw new ForbiddenException(
          'Usuário autenticado não possui perfil de gestor.',
        );
      }

      const hasAuthority = await this.bmRepo.findOne({
        where: {
          manager: { id: requesterManager.id },
          business: { id: dto.businessId },
        },
      });

      if (!hasAuthority) {
        throw new ForbiddenException(
          'Você não possui autoridade para gerenciar esta unidade.',
        );
      }
    }

    const exists = await this.bmRepo.findOne({
      where: {
        manager: { id: dto.managerId },
        business: { id: dto.businessId },
      },
    });

    if (exists)
      throw new ConflictException('Este vínculo de gestão já existe.');

    const link = this.bmRepo.create({
      manager: { id: dto.managerId },
      business: { id: dto.businessId },
    });

    return await this.bmRepo.save(link);
  }

  async remove(
    id: string,
    requester: ActiveUser,
  ): Promise<{ message: string }> {
    const link = await this.findOne(id);

    if (!requester.roles.includes('admin')) {
      const requesterManager = await this.managerRepo.findOne({
        where: { user: { id: requester.id } },
      });

      const hasAuthority = await this.bmRepo.findOne({
        where: {
          manager: { id: requesterManager?.id },
          business: { id: link.business.id },
        },
      });

      if (!hasAuthority) {
        throw new ForbiddenException(
          'Permissão negada para remover este gestor.',
        );
      }
    }

    await this.bmRepo.remove(link);
    return { message: 'Vínculo de gestão removido com sucesso.' };
  }

  async findAll() {
    return await this.bmRepo.find({
      relations: ['manager', 'manager.user', 'business'],
    });
  }

  async findOne(id: string) {
    const link = await this.bmRepo.findOne({
      where: { id },
      relations: ['manager', 'manager.user', 'business'],
    });
    if (!link) throw new NotFoundException('Vínculo não encontrado.');
    return link;
  }

  async findByBusiness(businessId: string) {
    return await this.bmRepo.find({
      where: { business: { id: businessId } },
      relations: ['manager', 'manager.user'],
    });
  }
}
