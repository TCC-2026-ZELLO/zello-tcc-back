import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DASHBOARD_MESSAGES } from './constants/dashboard.constants';
import { DASHBOARD_TOKENS } from './constants/dashboard.tokens';
import type { IBusinessViewRepository } from './interfaces/dashboard-repositories.interface';

/**
 * Registro de visualizações da página do estabelecimento (insumo do funil do RF30).
 */
@Injectable()
export class BusinessViewsService {
  constructor(
    @Inject(DASHBOARD_TOKENS.businessViewRepository)
    private readonly businessViewRepository: IBusinessViewRepository,
  ) {}

  /**
   * Idempotente: repetir no mesmo dia não gera nova visualização, e o gestor do
   * próprio estabelecimento é ignorado silenciosamente.
   */
  async registerView(businessId: string, viewerId: string): Promise<void> {
    const exists = await this.businessViewRepository.businessExists(businessId);
    if (!exists) {
      throw new NotFoundException(DASHBOARD_MESSAGES.businessNotFound);
    }

    await this.businessViewRepository.registerView(businessId, viewerId);
  }
}
