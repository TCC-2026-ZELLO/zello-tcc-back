import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessProfessional } from './entities/business-professional.entity';
import { CreateBusinessProfessionalDto } from './dto/create-business-professional-dto';
import { UpdateBusinessProfessionalDto } from './dto/update-business-professional.dto';
import { BusinessManager } from '../business-managers/entities/business-manager.entity';
import { Manager } from '../profiles/managers/entities/manager.entity';
import { BusinessProfessionalService } from './entities/business-professional-service.entity';
import { Professional } from '../profiles/professionals/entities/professional.entity';

@Injectable()
export class BusinessProfessionalsService {
  constructor(
    @InjectRepository(BusinessProfessional)
    private readonly bpRepo: Repository<BusinessProfessional>,

    @InjectRepository(BusinessProfessionalService)
    private readonly bpsRepo: Repository<BusinessProfessionalService>,

    @InjectRepository(BusinessManager)
    private readonly bmRepo: Repository<BusinessManager>,

    @InjectRepository(Professional)
    private readonly professionalRepo: Repository<Professional>,

    @InjectRepository(Manager)
    private readonly managerRepo: Repository<Manager>,
  ) {}

  async create(dto: CreateBusinessProfessionalDto, userId: string) {
    const manager = await this.managerRepo.findOne({
      where: { user: { id: userId } },
    });

    if (!manager)
      throw new ForbiddenException('Apenas gestores podem realizar esta ação.');

    const hasAuthority = await this.bmRepo.findOne({
      where: {
        manager: { id: manager.id },
        business: { id: dto.businessId },
      },
    });

    if (!hasAuthority)
      throw new ForbiddenException(
        'Você não tem permissão para gerenciar esta empresa.',
      );

    const professional = await this.professionalRepo.findOne({
      where: {
        user: { email: dto.email },
      },
      relations: ['user'],
    });

    if (!professional) {
      throw new NotFoundException(
        'Nenhum profissional cadastrado com este e-mail.',
      );
    }

    const exists = await this.bpRepo.findOne({
      where: {
        professional: { id: professional.id },
        business: { id: dto.businessId },
      },
    });

    if (exists)
      throw new ConflictException(
        'Este profissional já está vinculado a esta empresa.',
      );

    const link = this.bpRepo.create({
      professional: { id: professional.id },
      business: { id: dto.businessId },
      active: dto.active ?? true,
    });

    return await this.bpRepo.save(link);
  }

  async findAllByBusiness(businessId: string) {
    return await this.bpRepo.find({
      where: { business: { id: businessId } },
      relations: ['professional', 'professional.user'],
    });
  }

  async findAll() {
    return await this.bpRepo.find({
      relations: ['professional', 'professional.user', 'business'],
    });
  }

  async findOne(id: string) {
    const link = await this.bpRepo.findOne({
      where: { id },
      relations: ['professional', 'professional.user', 'business'],
    });
    if (!link) throw new NotFoundException('Vínculo não encontrado.');
    return link;
  }

  async update(id: string, dto: UpdateBusinessProfessionalDto) {
    const link = await this.findOne(id);
    this.bpRepo.merge(link, dto);
    return await this.bpRepo.save(link);
  }

  async remove(id: string) {
    const link = await this.findOne(id);
    await this.bpRepo.remove(link);
    return { message: 'Vínculo removido com sucesso.' };
  }

  async findProfessionalServices(bpId: string) {
    await this.findOne(bpId);

    return await this.bpsRepo.find({
      where: { businessProfessional: { id: bpId } },
      relations: ['service'],
    });
  }

  async updateProfessionalServices(bpId: string, serviceIds: string[]) {
    await this.bpsRepo.delete({ businessProfessional: { id: bpId } });

    const newLinks = serviceIds.map((serviceId) =>
      this.bpsRepo.create({
        businessProfessional: { id: bpId },
        service: { id: serviceId },
      }),
    );

    return await this.bpsRepo.save(newLinks);
  }
}
