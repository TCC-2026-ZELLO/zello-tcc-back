import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Combo } from './entities/combo.entity';
import { ComboItem } from './entities/combo-item.entity';
import { Service } from '../catalog/entities/service.entity';
import { Manager } from '../profiles/managers/entities/manager.entity';
import { BusinessManager } from '../business-managers/entities/business-manager.entity';
import { CreateComboDto, UpdateComboDto } from './dto/combo.dto';
import { buildComboPlan } from './combo-plan';

const COMBO_RELATIONS = ['items', 'items.service', 'business'];

@Injectable()
export class CombosService {
  constructor(
    @InjectRepository(Combo)
    private readonly comboRepo: Repository<Combo>,
    @InjectRepository(ComboItem)
    private readonly itemRepo: Repository<ComboItem>,
    @InjectRepository(Service)
    private readonly serviceRepo: Repository<Service>,
    @InjectRepository(Manager)
    private readonly managerRepo: Repository<Manager>,
    @InjectRepository(BusinessManager)
    private readonly bmRepo: Repository<BusinessManager>,
  ) {}

  // ─── Escrita (gestor) ──────────────────────────────────────────────────────

  async create(businessId: string, userId: string, dto: CreateComboDto) {
    await this.assertManagerAuthority(userId, businessId);
    const services = await this.loadServices(businessId, dto.items);

    const combo = this.comboRepo.create({
      name: dto.name,
      description: dto.description ?? null,
      price: dto.price,
      active: dto.active ?? true,
      business: { id: businessId } as any,
      items: dto.items.map((item) =>
        this.itemRepo.create({
          service: services.get(item.serviceId),
          sequence: item.sequence ?? 0,
        }),
      ),
    });

    this.assertPromotional(combo);

    const saved = await this.comboRepo.save(combo);
    return this.toPublic(await this.findEntity(saved.id));
  }

  async update(id: string, userId: string, dto: UpdateComboDto) {
    const combo = await this.findEntity(id);
    await this.assertManagerAuthority(userId, combo.business.id);

    if (dto.name !== undefined) combo.name = dto.name;
    if (dto.description !== undefined) combo.description = dto.description;
    if (dto.price !== undefined) combo.price = dto.price;
    if (dto.active !== undefined) combo.active = dto.active;

    if (dto.items) {
      if (dto.items.length < 2) {
        throw new BadRequestException(
          'Um combo precisa de pelo menos dois serviços.',
        );
      }
      const services = await this.loadServices(combo.business.id, dto.items);
      await this.itemRepo.delete({ combo: { id: combo.id } });
      combo.items = dto.items.map((item) =>
        this.itemRepo.create({
          service: services.get(item.serviceId),
          sequence: item.sequence ?? 0,
        }),
      );
    }

    this.assertPromotional(combo);

    await this.comboRepo.save(combo);
    return this.toPublic(await this.findEntity(id));
  }

  async remove(id: string, userId: string) {
    const combo = await this.findEntity(id);
    await this.assertManagerAuthority(userId, combo.business.id);

    // Soft delete: grupos de agendamento já criados continuam referenciando
    // o combo (a FK é SET NULL, e o nome fica no snapshot do grupo).
    await this.comboRepo.softRemove(combo);
    return { message: 'Combo removido do catálogo.' };
  }

  // ─── Leitura ───────────────────────────────────────────────────────────────

  async findAllByBusiness(businessId: string, includeInactive = false) {
    const combos = await this.comboRepo.find({
      where: {
        business: { id: businessId },
        ...(includeInactive ? {} : { active: true }),
      },
      relations: COMBO_RELATIONS,
      order: { createdAt: 'DESC' },
    });

    return combos.map((combo) => this.toPublic(combo));
  }

  async findOne(id: string) {
    return this.toPublic(await this.findEntity(id));
  }

  async findEntity(id: string): Promise<Combo> {
    const combo = await this.comboRepo.findOne({
      where: { id },
      relations: COMBO_RELATIONS,
    });
    if (!combo) throw new NotFoundException('Combo não encontrado.');
    return combo;
  }

  toPublic(combo: Combo) {
    const plan = buildComboPlan(combo);

    return {
      id: combo.id,
      name: combo.name,
      description: combo.description,
      active: combo.active,
      isCombo: true,
      businessId: combo.business?.id,
      originalPrice: plan.originalPrice,
      price: plan.finalPrice,
      discount: plan.discount,
      discountPercent: plan.discountPercent,
      durationMinutes: plan.totalDuration,
      blockMinutes: plan.totalBlock,
      requiresMultipleProfessionals: plan.stages.some(
        (stage) => stage.tasks.length > 1,
      ),
      stages: plan.stages.map((stage) => ({
        sequence: stage.sequence,
        offsetMinutes: stage.offset,
        durationMinutes: stage.duration,
        services: stage.tasks.map((task) => ({
          id: task.serviceId,
          name: task.serviceName,
          durationMinutes: task.duration,
          cleanupMinutes: task.block - task.duration,
          price: Number(task.item.service.price ?? 0),
        })),
      })),
    };
  }

  // ─── Internos ──────────────────────────────────────────────────────────────

  private assertPromotional(combo: Combo) {
    const plan = buildComboPlan(combo);
    if (plan.finalPrice >= plan.originalPrice) {
      throw new BadRequestException(
        `O valor do combo deve ser menor que a soma dos serviços (R$ ${plan.originalPrice.toFixed(2)}).`,
      );
    }
  }

  private async loadServices(
    businessId: string,
    items: { serviceId: string }[],
  ): Promise<Map<string, Service>> {
    const ids = [...new Set(items.map((i) => i.serviceId))];

    if (ids.length < 2) {
      throw new BadRequestException(
        'Um combo precisa de pelo menos dois serviços distintos.',
      );
    }

    const services = await this.serviceRepo.find({
      where: { id: In(ids), business: { id: businessId } },
    });

    if (services.length !== ids.length) {
      throw new BadRequestException(
        'Um ou mais serviços não pertencem a esta empresa.',
      );
    }

    return new Map(services.map((service) => [service.id, service]));
  }

  private async assertManagerAuthority(userId: string, businessId: string) {
    const manager = await this.managerRepo.findOne({
      where: { user: { id: userId } },
    });
    if (!manager) {
      throw new ForbiddenException('Perfil de gestor não encontrado.');
    }

    const link = await this.bmRepo.findOne({
      where: { manager: { id: manager.id }, business: { id: businessId } },
    });
    if (!link) {
      throw new ForbiddenException(
        'Você não tem permissão para gerenciar esta empresa.',
      );
    }
  }
}
