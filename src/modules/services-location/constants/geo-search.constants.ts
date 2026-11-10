/**
 * Raio fixo (em quilômetros) da busca de estabelecimentos por geolocalização (RF13).
 *
 * Este valor é uma constraint de negócio do sistema, não um parâmetro de API:
 * o cliente nunca pode ampliá-lo pela interface (CA2 — "Travamento de
 * expansão"). Por isso ele não existe em nenhum DTO de entrada — apenas aqui,
 * como constante consumida internamente por SearchServicesByLocationService.
 */
export const SERVICES_SEARCH_RADIUS_KM = 10;

/** Mensagem padrão retornada quando nenhum estabelecimento é encontrado no raio (CA3). */
export const NO_RESULTS_MESSAGE = 'Nenhum prestador encontrado no raio de 10km';
