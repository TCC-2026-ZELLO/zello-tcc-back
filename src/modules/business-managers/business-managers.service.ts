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

@Injectable()
export class BusinessManagersService {
  constructor(
    @InjectRepository(BusinessManager)
    private readonly bmRepo: Repository<BusinessManager>,
    @InjectRepository(Manager)
    private readonly managerRepo: Repository<Manager>,
  ) {}

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
