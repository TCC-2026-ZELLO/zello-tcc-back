import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appointment } from '../../appointments/entities/appointment.entity';
import {
  EFFECTIVE_PRICE_JOINS_SQL,
  EFFECTIVE_PRICE_SQL,
} from '../constants/dashboard.constants';
import { ITeamRepository } from '../interfaces/dashboard-repositories.interface';
import { TeamPerformanceRow } from '../interfaces/dashboard-rows.interface';

/**
 * Performance da equipe (RF30 — CA2).
 *
 * Elenco = profissionais com vínculo ativo no estabelecimento (incluindo os
 * sem atendimento no período, com 0) ∪ profissionais que atenderam no período
 * mesmo que hoje estejam desvinculados — para a receita da equipe fechar com o
 * faturamento global.
 */
@Injectable()
export class TeamRepository implements ITeamRepository {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
  ) {}

  async findPerformance(
    businessId: string,
    from: string,
    to: string,
  ): Promise<TeamPerformanceRow[]> {
    return this.appointmentRepository.query<TeamPerformanceRow[]>(
      `
        WITH completed AS (
          SELECT
            a."professionalId" AS professional_id,
            COUNT(*)::int AS appointments_count,
            COALESCE(SUM(${EFFECTIVE_PRICE_SQL}), 0) AS revenue
          FROM appointments a
          ${EFFECTIVE_PRICE_JOINS_SQL}
          WHERE
            a."businessId" = $1
            AND a."deletedAt" IS NULL
            AND a.status = 'COMPLETED'
            AND a.date BETWEEN $2 AND $3
            AND a."professionalId" IS NOT NULL
          GROUP BY a."professionalId"
        ),
        roster AS (
          SELECT bp.professional_id
          FROM professional_business bp
          INNER JOIN professional p ON p.id = bp.professional_id
          WHERE
            bp.business_id = $1
            AND bp.active = true
            AND p.deleted_at IS NULL
          UNION
          SELECT professional_id FROM completed
        )
        SELECT
          p.id AS professional_id,
          u.name AS name,
          COALESCE(c.appointments_count, 0)::int AS appointments_count,
          COALESCE(c.revenue, 0)::text AS revenue
        FROM roster r
        INNER JOIN professional p ON p.id = r.professional_id
        INNER JOIN "user" u ON u.id = p.user_id
        LEFT JOIN completed c ON c.professional_id = r.professional_id
        ORDER BY COALESCE(c.revenue, 0) DESC, u.name ASC
      `,
      [businessId, from, to],
    );
  }
}
