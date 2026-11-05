import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessView } from '../entities/business-view.entity';
import { IBusinessViewRepository } from '../interfaces/dashboard-repositories.interface';

/**
 * Escrita de visualizações da página do estabelecimento (insumo do funil do
 * RF30 — CA3). A leitura agregada fica em VisibilityRepository.
 */
@Injectable()
export class BusinessViewRepository implements IBusinessViewRepository {
  constructor(
    @InjectRepository(BusinessView)
    private readonly businessViewRepository: Repository<BusinessView>,
  ) {}

  async businessExists(businessId: string): Promise<boolean> {
    const rows = await this.businessViewRepository.query<unknown[]>(
      `SELECT 1 FROM business WHERE id = $1 AND deleted_at IS NULL`,
      [businessId],
    );
    return rows.length > 0;
  }

  /**
   * Registra a visualização de forma idempotente (1 por usuário/negócio/dia,
   * `view_date` no timezone do negócio). Ignora silenciosamente quando o
   * visitante é gestor do próprio estabelecimento.
   *
   * @returns `true` se uma nova linha foi inserida.
   */
  async registerView(businessId: string, viewerId: string): Promise<boolean> {
    const rows = await this.businessViewRepository.query<{ id: string }[]>(
      `
        INSERT INTO business_view (business_id, viewer_id, view_date)
        SELECT b.id, $2, (now() AT TIME ZONE b.timezone)::date
        FROM business b
        WHERE
          b.id = $1
          AND b.deleted_at IS NULL
          AND NOT EXISTS (
            SELECT 1
            FROM manager_business mb
            INNER JOIN manager m ON m.id = mb.manager_id
            WHERE mb.business_id = b.id AND m.user_id = $2
          )
        ON CONFLICT (business_id, viewer_id, view_date) DO NOTHING
        RETURNING id
      `,
      [businessId, viewerId],
    );
    return rows.length > 0;
  }
}
