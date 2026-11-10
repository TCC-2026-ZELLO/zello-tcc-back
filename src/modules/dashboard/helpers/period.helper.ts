/**
 * Helpers puros de período do dashboard (RF30). Sem dependência de Nest/TypeORM.
 *
 * Todas as datas são strings `YYYY-MM-DD` já no calendário local do negócio;
 * a aritmética é feita em UTC apenas para evitar efeitos de horário de verão.
 */

export interface DashboardPeriod {
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
}

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toUtcMs(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function fromUtcMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** `true` se a string é uma data de calendário real no formato YYYY-MM-DD. */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DATE_REGEX.test(value)) return false;
  return fromUtcMs(toUtcMs(value)) === value;
}

export function addDays(date: string, days: number): string {
  return fromUtcMs(toUtcMs(date) + days * MS_PER_DAY);
}

/** Quantidade de dias do intervalo, contando `from` e `to`. */
export function countDaysInclusive(from: string, to: string): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / MS_PER_DAY) + 1;
}

/** Lista cada dia do intervalo (inclusivo); vazia se `to < from`. */
export function listDays(from: string, to: string): string[] {
  const total = countDaysInclusive(from, to);
  return Array.from({ length: Math.max(total, 0) }, (_, i) => addDays(from, i));
}

/**
 * Valida o intervalo e devolve a mensagem de erro (pt-BR) ou `null` se válido.
 */
export function validatePeriod(
  from: unknown,
  to: unknown,
  maxDays: number,
): string | null {
  if (!isIsoDate(from)) {
    return 'A data inicial (from) deve ser uma data válida no formato YYYY-MM-DD.';
  }
  if (!isIsoDate(to)) {
    return 'A data final (to) deve ser uma data válida no formato YYYY-MM-DD.';
  }
  if (to < from) {
    return 'A data final (to) deve ser maior ou igual à data inicial (from).';
  }
  if (countDaysInclusive(from, to) > maxDays) {
    return `O período selecionado deve ter no máximo ${maxDays} dias.`;
  }
  return null;
}

export function resolvePeriod(from: string, to: string): DashboardPeriod {
  const length = countDaysInclusive(from, to);
  const previousTo = addDays(from, -1);
  const previousFrom = addDays(previousTo, -(length - 1));
  return { from, to, previousFrom, previousTo };
}
