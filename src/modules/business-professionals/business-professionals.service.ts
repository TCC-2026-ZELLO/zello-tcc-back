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
import { ProfessionalShift } from '../availability/entities/professional-shift.entity';
import { BusinessOperatingHour } from '../availability/entities/business_operating_hour.entity';
import { Service } from '../catalog/entities/service.entity';
import { In } from 'typeorm';
import {
  Requester,
  TenantAccessService,
} from '../../common/security/tenant-access.service';

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

    @InjectRepository(ProfessionalShift)
    private readonly shiftRepo: Repository<ProfessionalShift>,

    private readonly tenantAccess: TenantAccessService,
  ) {}

  /**
   * v5.0.0-8.2.2 / 8.4.1: carrega o vínculo e confirma que o solicitante
   * gerencia o estabelecimento dono dele antes de qualquer alteração.
   */
  private async loadManagedLink(id: string, requester: Requester) {
    const link = await this.findOne(id);
    await this.tenantAccess.assertManagesBusiness(requester, link.business.id);
    return link;
  }

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

  /** Equipe com contatos, restrita ao gestor do estabelecimento (v5.0.0-8.4.1). */
  async findTeamForManager(businessId: string, requester: Requester) {
    await this.tenantAccess.assertManagesBusiness(requester, businessId, {
      allowAdmin: true,
    });
    return this.findAllByBusiness(businessId);
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

  async update(
    id: string,
    dto: UpdateBusinessProfessionalDto,
    requester: Requester,
  ) {
    const link = await this.loadManagedLink(id, requester);
    // v5.0.0-15.3.3: só o campo `active` é alterável; estabelecimento e
    // profissional do vínculo nunca são reatribuídos por esta rota.
    if (dto.active !== undefined) link.active = dto.active;
    return await this.bpRepo.save(link);
  }

  async remove(id: string, requester: Requester) {
    const link = await this.loadManagedLink(id, requester);
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

  async updateProfessionalServices(
    bpId: string,
    serviceIds: string[],
    requester: Requester,
  ) {
    const link = await this.loadManagedLink(bpId, requester);

    // Todos os serviços precisam pertencer ao mesmo estabelecimento do
    // vínculo; não é possível habilitar serviço de outro tenant.
    const uniqueIds = Array.from(new Set(serviceIds));
    if (uniqueIds.length > 0) {
      const owned = await this.bpRepo.manager.count(Service, {
        where: { id: In(uniqueIds), business: { id: link.business.id } },
      });
      if (owned !== uniqueIds.length) {
        throw new ForbiddenException(
          'Um ou mais serviços não pertencem a este estabelecimento.',
        );
      }
    }
    serviceIds = uniqueIds;

    await this.bpsRepo.delete({ businessProfessional: { id: bpId } });

    const newLinks = serviceIds.map((serviceId) =>
      this.bpsRepo.create({
        businessProfessional: { id: bpId },
        service: { id: serviceId },
      }),
    );

    return await this.bpsRepo.save(newLinks);
  }

  async findProfessionalShifts(bpId: string) {
    await this.findOne(bpId);
    return await this.shiftRepo.find({
      where: { businessProfessional: { id: bpId } },
      order: { dayOfWeek: 'ASC' },
    });
  }

  async updateProfessionalShifts(
    bpId: string,
    shifts: { dayOfWeek: number; startTime: string; endTime: string }[],
    requester: Requester,
  ) {
    const bp = await this.bpRepo.findOne({
      where: { id: bpId },
      relations: ['business'],
    });

    if (!bp) throw new NotFoundException('Vínculo não encontrado.');
    await this.tenantAccess.assertManagesBusiness(requester, bp.business.id);
    const businessId = bp.business.id;

    return await this.bpRepo.manager.transaction(async (em) => {
      // Pega os horários da loja
      const businessHours = await em.find<BusinessOperatingHour>(
        BusinessOperatingHour,
        {
          where: { business: { id: businessId } },
        },
      );

      await em.delete(ProfessionalShift, {
        businessProfessional: { id: bpId },
      });

      const newShifts: ProfessionalShift[] = [];
      for (const s of shifts) {
        const bh = businessHours.find((h) => h.dayOfWeek === s.dayOfWeek);
        if (!bh || !bh.isOpen) continue; // Loja fechada no dia, ignora o turno

        newShifts.push(
          em.create(ProfessionalShift, {
            dayOfWeek: s.dayOfWeek,
            startTime: bh.startTime,
            endTime: bh.endTime,
            businessProfessional: { id: bpId },
          }),
        );
      }

      return await em.save(ProfessionalShift, newShifts);
    });
  }
}
