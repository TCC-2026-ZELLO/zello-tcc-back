import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessView } from '../entities/business-view.entity';
import { IVisibilityRepository } from '../interfaces/dashboard-repositories.interface';
import { VisibilityFunnelRow } from '../interfaces/dashboard-rows.interface';

/**
 * Leitura do funil de visibilidade (RF30 — CA3): visualizações da página do
 * estabelecimento vs agendamentos criados. A escrita das visualizações fica em
 * BusinessViewRepository.
 */
@Injectable()
export class VisibilityRepository implements IVisibilityRepository {
  constructor(
    @InjectRepository(BusinessView)
    private readonly businessViewRepository: Repository<BusinessView>,
  ) {}

  /**
   * - views: visualizações (já deduplicadas por usuário/dia) com `view_date` no período.
   * - appointments: agendamentos CRIADOS no período — `createdAt` (timestamp
   *   sem tz, gravado em UTC) convertido para o timezone do negócio — com
   *   qualquer status, exceto CANCELLED com `cancelledByRole` nulo (pendente
   *   expirado, nunca confirmado).
   */
  async findFunnel(
    businessId: string,
    from: string,
    to: string,
  ): Promise<VisibilityFunnelRow> {
    const rows = await this.businessViewRepository.query<VisibilityFunnelRow[]>(
      `
        SELECT
          (
            SELECT COUNT(*)::int
            FROM business_view v
            WHERE v.business_id = $1 AND v.view_date BETWEEN $2 AND $3
          ) AS views,
          (
            SELECT COUNT(*)::int
            FROM appointments a
            INNER JOIN business b ON b.id = a."businessId"
            WHERE
              a."businessId" = $1
              AND a."deletedAt" IS NULL
              AND (a."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE b.timezone)::date
                BETWEEN $2 AND $3
              AND NOT (a.status = 'CANCELLED' AND a."cancelledByRole" IS NULL)
          ) AS appointments
      `,
      [businessId, from, to],
    );

    return rows[0] ?? { views: 0, appointments: 0 };
  }
}
