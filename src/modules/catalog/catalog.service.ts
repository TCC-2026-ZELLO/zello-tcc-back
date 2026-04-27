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
  ) {}
  async create(dto: CreateServiceDto, userId: string, businessId: string) {
    console.log('--- DEBUG CATALOG CREATE ---');
    console.log('User ID do Token:', userId);
    console.log('Business ID vindo da URL:', businessId);

    const manager = await this.managerRepo.findOne({
      where: { user: { id: userId } },
    });

    console.log('Manager encontrado no banco:', manager?.id);

    const hasAccess = await this.businessManagerRepo.findOne({
      where: {
        manager: { id: manager?.id },
        business: { id: businessId },
      },
    });

    console.log('Vínculo encontrado (hasAccess):', hasAccess ? 'SIM' : 'NÃO');

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

  async update(id: string, dto: UpdateServiceDto) {
    const service = await this.findOne(id);
    this.serviceRepo.merge(service, dto);
    return await this.serviceRepo.save(service);
  }

  async remove(id: string) {
    const service = await this.findOne(id);
    const businessId = service.business.id;

    await this.serviceRepo.remove(service);

    const links = await this.bpRepo.find({
      where: { business: { id: businessId } },
      relations: ['professional'],
    });

    for (const link of links) {
      await this.professionalsService.revalidateVisibility(
        link.professional.id,
      );
    }

    return { message: 'Serviço removido e perfis revalidados.' };
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
