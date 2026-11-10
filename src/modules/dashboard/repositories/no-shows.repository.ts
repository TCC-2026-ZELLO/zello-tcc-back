import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appointment } from '../../appointments/entities/appointment.entity';
import {
  EFFECTIVE_PRICE_JOINS_SQL,
  EFFECTIVE_PRICE_SQL,
  UNJUSTIFIED_CANCELLATION_ROLES,
} from '../constants/dashboard.constants';
import { INoShowsRepository } from '../interfaces/dashboard-repositories.interface';
import { NoShowSummaryRow } from '../interfaces/dashboard-rows.interface';

/**
 * Perda de receita estimada por agendamentos não realizados (RF30 — CA5).
 *
 * Conta, pela `date` do agendamento no período:
 * - todo status NO_SHOW (marcado pelo gestor ou automaticamente pelo cron —
 *   limitação: se o gestor não concluir o atendimento, o cron o converte em
 *   NO_SHOW e ele entra aqui);
 * - CANCELLED com `cancelledByRole` em UNJUSTIFIED_CANCELLATION_ROLES.
 */
@Injectable()
export class NoShowsRepository implements INoShowsRepository {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
  ) {}

  async findSummary(
    businessId: string,
    from: string,
    to: string,
  ): Promise<NoShowSummaryRow> {
    const rows = await this.appointmentRepository.query<NoShowSummaryRow[]>(
      `
        SELECT
          COUNT(*) FILTER (WHERE a.status = 'NO_SHOW')::int AS no_show_count,
          COUNT(*) FILTER (WHERE a.status = 'CANCELLED')::int
            AS unjustified_cancellation_count,
          COALESCE(SUM(${EFFECTIVE_PRICE_SQL}), 0)::text AS lost_revenue
        FROM appointments a
        ${EFFECTIVE_PRICE_JOINS_SQL}
        WHERE
          a."businessId" = $1
          AND a."deletedAt" IS NULL
          AND a.date BETWEEN $2 AND $3
          AND (
            a.status = 'NO_SHOW'
            OR (a.status = 'CANCELLED' AND a."cancelledByRole" = ANY($4))
          )
      `,
      [businessId, from, to, UNJUSTIFIED_CANCELLATION_ROLES],
    );

    return (
      rows[0] ?? {
        no_show_count: 0,
        unjustified_cancellation_count: 0,
        lost_revenue: '0',
      }
    );
  }
}
