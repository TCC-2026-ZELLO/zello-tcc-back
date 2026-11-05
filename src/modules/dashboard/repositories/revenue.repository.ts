import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appointment } from '../../appointments/entities/appointment.entity';
import {
  EFFECTIVE_PRICE_JOINS_SQL,
  EFFECTIVE_PRICE_SQL,
} from '../constants/dashboard.constants';
import { IRevenueRepository } from '../interfaces/dashboard-repositories.interface';
import {
  RevenueBreakdownRow,
  RevenueTotalRow,
} from '../interfaces/dashboard-rows.interface';

/**
 * Consultas agregadas de faturamento (RF30 — CA1/CA4).
 *
 * Receita estimada = soma do preço efetivo (ver EFFECTIVE_PRICE_SQL) dos
 * agendamentos COMPLETED cuja `date` está no período.
 */
@Injectable()
export class RevenueRepository implements IRevenueRepository {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
  ) {}

  /** Receita e quantidade de atendimentos agrupadas por serviço e por dia. */
  async findBreakdown(
    businessId: string,
    from: string,
    to: string,
  ): Promise<RevenueBreakdownRow[]> {
    return this.appointmentRepository.query<RevenueBreakdownRow[]>(
      `
        SELECT
          s.id AS service_id,
          s.name AS service_name,
          a.date::text AS date,
          COUNT(*)::int AS appointments_count,
          COALESCE(SUM(${EFFECTIVE_PRICE_SQL}), 0)::text AS revenue
        FROM appointments a
        ${EFFECTIVE_PRICE_JOINS_SQL}
        WHERE
          a."businessId" = $1
          AND a."deletedAt" IS NULL
          AND a.status = 'COMPLETED'
          AND a.date BETWEEN $2 AND $3
        GROUP BY s.id, s.name, a.date
      `,
      [businessId, from, to],
    );
  }

  /** Receita total e quantidade de atendimentos (usado no período anterior). */
  async findTotal(
    businessId: string,
    from: string,
    to: string,
  ): Promise<RevenueTotalRow> {
    const rows = await this.appointmentRepository.query<RevenueTotalRow[]>(
      `
        SELECT
          COUNT(*)::int AS completed_count,
          COALESCE(SUM(${EFFECTIVE_PRICE_SQL}), 0)::text AS revenue
        FROM appointments a
        ${EFFECTIVE_PRICE_JOINS_SQL}
        WHERE
          a."businessId" = $1
          AND a."deletedAt" IS NULL
          AND a.status = 'COMPLETED'
          AND a.date BETWEEN $2 AND $3
      `,
      [businessId, from, to],
    );

    return rows[0] ?? { completed_count: 0, revenue: '0' };
  }
}
