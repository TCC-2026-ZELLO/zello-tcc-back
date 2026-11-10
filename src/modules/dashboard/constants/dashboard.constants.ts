/**
 * Intervalo máximo (em dias, inclusivo) aceito pelo dashboard de faturamento (RF30).
 * Limita o custo das agregações e o tamanho da série temporal devolvida ao front.
 */
export const MAX_DASHBOARD_PERIOD_DAYS = 366;

/**
 * Valores de `cancelledByRole` que caracterizam um cancelamento NÃO justificado (CA5).
 *
 * - 'client'  → cliente cancelou.
 * - 'manager' → gestor cancelou marcando que afeta a reputação do cliente.
 *
 * Ficam de fora: 'manager_justified' (cancelamento justificado pelo gestor) e
 * `null` (pendente expirado pelo cron — nunca chegou a ser confirmado, então não
 * representa receita perdida).
 */
export const UNJUSTIFIED_CANCELLATION_ROLES: readonly string[] = [
  'client',
  'manager',
];

/**
 * Fragmento SQL do PREÇO EFETIVO de um agendamento. Exige os aliases
 * `s` (service) e `g` (appointment_groups, via LEFT JOIN).
 *
 * Regra:
 * - Agendamento avulso: `Service.price`.
 * - Agendamento de combo (group não nulo e originalPrice > 0):
 *   `Service.price * (group.finalPrice / group.originalPrice)`, distribuindo o
 *   desconto do combo proporcionalmente entre os serviços que o compõem.
 *
 * LIMITAÇÃO CONHECIDA (registrada no TCC): o agendamento não guarda snapshot do
 * preço praticado. Alterar `Service.price` altera retroativamente o faturamento
 * histórico exibido no dashboard. Nenhuma coluna foi adicionada para isso por
 * decisão de escopo.
 */
export const EFFECTIVE_PRICE_SQL = `(
  s.price::numeric * CASE
    WHEN g.id IS NOT NULL AND g."originalPrice" > 0
      THEN g."finalPrice"::numeric / g."originalPrice"::numeric
    ELSE 1
  END
)`;

export const EFFECTIVE_PRICE_JOINS_SQL = `
  INNER JOIN service s ON s.id = a."serviceId"
  LEFT JOIN appointment_groups g ON g.id = a."groupId"
`;

export const DASHBOARD_MESSAGES = {
  managerProfileNotFound: 'Perfil de gestor não encontrado.',
  forbiddenBusiness:
    'Você não tem permissão para acessar o dashboard desta empresa.',
  invalidBusinessId: 'O identificador do estabelecimento é inválido.',
  businessNotFound: 'Estabelecimento não encontrado.',
} as const;
