import { ServiceLocationResponseDto } from './service-location-response.dto';

/**
 * Resultado de negócio (sem envelope HTTP) produzido por
 * SearchServicesByLocationService. O Controller é responsável por acrescentar
 * o `status` HTTP e devolver exatamente este formato ao cliente.
 */
export interface ServicesByLocationResultDto {
  data: ServiceLocationResponseDto[];
  total: number;
  /** Presente somente quando a lista vem vazia (CA3). */
  message?: string;
}
