export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Variação percentual (CA4): (atual - anterior) / anterior * 100.
 * Retorna `null` quando o anterior é 0 — não há base de comparação.
 */
export function variationPercent(
  current: number,
  previous: number,
): number | null {
  if (previous === 0) return null;
  return round2(((current - previous) / previous) * 100);
}

/** Participação percentual de `part` em `total`; `null` se `total` é 0. */
export function percentOf(part: number, total: number): number | null {
  if (total === 0) return null;
  return round2((part / total) * 100);
}
