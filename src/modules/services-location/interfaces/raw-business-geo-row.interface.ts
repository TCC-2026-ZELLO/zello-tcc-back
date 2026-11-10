/**
 * Formato bruto retornado pela query SQL de BusinessGeolocationRepository.
 *
 * Todos os campos numéricos chegam como `string` porque o driver `pg` (node-postgres)
 * serializa `numeric`/`decimal`/`double precision` agregados como texto por padrão,
 * para não perder precisão. A conversão para `number` acontece em
 * SearchServicesByLocationService, que é quem decide o formato de saída da API —
 * nunca dentro do próprio repositório.
 */
export interface RawBusinessGeoRow {
  id: string;
  trade_name: string;
  category: string | null;
  average_rating: string;
  latitude: string;
  longitude: string;
  distance_km: string;
  services_summary: string | null;
}
