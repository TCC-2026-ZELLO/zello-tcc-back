import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessManager } from '../../modules/business-managers/entities/business-manager.entity';
import { BusinessProfessional } from '../../modules/business-professionals/entities/business-professional.entity';

export interface Requester {
  id: string;
  roles?: string[];
}

/**
 * Ponto único de decisão de isolamento multitenant (v5.0.0-8.2.2, 8.3.1, 8.4.1).
 *
 * O "tenant" do Zello é o estabelecimento (Business). Um usuário só pode ler
 * dados restritos ou alterar recursos de um estabelecimento quando existe o
 * vínculo `business_manager` entre o seu perfil de gestor e esse
 * estabelecimento. As regras ficam na camada de serviço confiável, nunca no
 * cliente, e são reutilizadas por todos os módulos.
 */
@Injectable()
export class TenantAccessService {
  constructor(
    @InjectRepository(BusinessManager)
    private readonly businessManagerRepo: Repository<BusinessManager>,
    @InjectRepository(BusinessProfessional)
    private readonly businessProfessionalRepo: Repository<BusinessProfessional>,
  ) {}

  isAdmin(requester: Requester): boolean {
    return requester.roles?.includes('admin') ?? false;
  }

  async managesBusiness(userId: string, businessId: string): Promise<boolean> {
    if (!userId || !businessId) return false;
    const link = await this.businessManagerRepo.findOne({
      where: {
        business: { id: businessId },
        manager: { user: { id: userId } },
      },
    });
    return !!link;
  }

  /**
   * Lança 403 quando o solicitante não gerencia o estabelecimento.
   * Administradores da plataforma só passam quando `allowAdmin` é verdadeiro.
   */
  async assertManagesBusiness(
    requester: Requester,
    businessId: string,
    options: { allowAdmin?: boolean } = {},
  ): Promise<void> {
    if (options.allowAdmin && this.isAdmin(requester)) return;
    if (await this.managesBusiness(requester.id, businessId)) return;
    throw new ForbiddenException(
      'Você não tem permissão para acessar os dados deste estabelecimento.',
    );
  }

  /** Verdadeiro quando o profissional tem vínculo com algum estabelecimento gerido pelo usuário. */
  async managesProfessional(
    userId: string,
    professionalId: string,
  ): Promise<boolean> {
    if (!userId || !professionalId) return false;
    const links = await this.businessProfessionalRepo.find({
      where: { professional: { id: professionalId } },
      relations: ['business'],
    });
    for (const link of links) {
      if (await this.managesBusiness(userId, link.business.id)) return true;
    }
    return false;
  }

  /** Verdadeiro quando o usuário é o profissional do vínculo informado. */
  async isProfessionalOfLink(
    userId: string,
    businessProfessionalId: string,
  ): Promise<boolean> {
    if (!userId || !businessProfessionalId) return false;
    const link = await this.businessProfessionalRepo.findOne({
      where: {
        id: businessProfessionalId,
        professional: { user: { id: userId } },
      },
    });
    return !!link;
  }
}
