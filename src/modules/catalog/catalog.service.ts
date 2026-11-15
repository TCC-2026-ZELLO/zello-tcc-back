import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Service } from './entities/service.entity';
import { CreateServiceDto } from './dto/create-service.dto';
import { ProfessionalsService } from '../profiles/professionals/professionals.service';
import { BusinessProfessional } from '../business-professionals/entities/business-professional.entity';
import { UpdateServiceDto } from './dto/update-service.dto';
import { Manager } from '../profiles/managers/entities/manager.entity';
import { BusinessManager } from '../business-managers/entities/business-manager.entity';
import {
  Requester,
  TenantAccessService,
} from '../../common/security/tenant-access.service';

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(Service)
    private readonly serviceRepo: Repository<Service>,
    @InjectRepository(BusinessManager)
    private readonly businessManagerRepo: Repository<BusinessManager>,
    @InjectRepository(Manager)
    private readonly managerRepo: Repository<Manager>,
    @InjectRepository(BusinessProfessional)
    private readonly bpRepo: Repository<BusinessProfessional>,
    private readonly professionalsService: ProfessionalsService,
    private readonly tenantAccess: TenantAccessService,
  ) {}
  async create(dto: CreateServiceDto, userId: string, businessId: string) {
    const manager = await this.managerRepo.findOne({
      where: { user: { id: userId } },
    });

    const hasAccess = manager
      ? await this.businessManagerRepo.findOne({
          where: {
            manager: { id: manager.id },
            business: { id: businessId },
          },
        })
      : null;

    if (!hasAccess) {
      throw new ForbiddenException(
        'Você não tem permissão para gerenciar esta empresa.',
      );
    }

    const service = this.serviceRepo.create({
      ...dto,
      business: { id: businessId },
    });

    return await this.serviceRepo.save(service);
  }

  async findAllByBusiness(businessId: string) {
    return await this.serviceRepo.find({
      where: { business: { id: businessId } },
    });
  }

  async findOne(id: string) {
    const service = await this.serviceRepo.findOne({
      where: { id },
      relations: ['business'],
    });
    if (!service) throw new NotFoundException('Serviço não encontrado.');
    return service;
  }

  async update(id: string, dto: UpdateServiceDto, requester: Requester) {
    const service = await this.findOne(id);
    // v5.0.0-8.4.1: o serviço só pode ser alterado por gestor do
    // estabelecimento ao qual ele pertence.
    await this.tenantAccess.assertManagesBusiness(
      requester,
      service.business.id,
    );
    const { name, description, durationMinutes, cleanupMinutes, price } = dto;

    this.serviceRepo.merge(service, {
      name,
      description,
      durationMinutes,
      cleanupMinutes,
      price,
    });

    return await this.serviceRepo.save(service);
  }

  async remove(id: string, requester: Requester) {
    const service = await this.findOne(id);
    await this.tenantAccess.assertManagesBusiness(
      requester,
      service.business.id,
    );

    await this.serviceRepo.save(service);

    const businessId = service.business.id;
    const links = await this.bpRepo.find({
      where: { business: { id: businessId } },
      relations: ['professional'],
    });

    for (const link of links) {
      await this.professionalsService.revalidateVisibility(
        link.professional.id,
      );
    }

    return { message: 'Serviço desativado e perfis revalidados com sucesso.' };
  }

  async getServiceDuration(id: string) {
    const service = await this.findOne(id);
    return {
      totalTime: service.durationMinutes + service.cleanupMinutes,
      duration: service.durationMinutes,
      cleanup: service.cleanupMinutes,
    };
  }
}
