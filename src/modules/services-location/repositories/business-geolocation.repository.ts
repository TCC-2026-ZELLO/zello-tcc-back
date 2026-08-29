import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Business } from '../../businesses/entities/business.entity';
import { RawBusinessGeoRow } from '../interfaces/raw-business-geo-row.interface';

/**
 * Extensão do repositório de Business dedicada à consulta geoespacial do RF13.
 *
 * Encapsula toda a query PostGIS (ST_DWithin/ST_Distance) para que o restante
 * do domínio de Business (BusinessesService, CatalogService, etc.) nem precise
 * saber que essa capacidade existe — Single Responsibility: este arquivo só
 * sabe "buscar estabelecimentos por geolocalização", nada além disso.
 */
@Injectable()
export class BusinessGeolocationRepository {
  constructor(
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
  ) {}

  /**
   * Retorna estabelecimentos ativos, com ao menos um serviço cadastrado, cujo
   * endereço esteja a até `radiusKm` quilômetros do ponto (latitude, longitude).
   *
   * - `ST_DWithin` faz o filtro de distância diretamente no banco, usando o
   *   índice GIST de `address.location` (evita cálculo de distância em
   *   aplicação e evita full scan).
   * - `ST_Distance` calcula a distância exata (em metros) apenas para as linhas
   *   já filtradas, para exibição ao cliente (`distanceKm`).
   * - O INNER JOIN com `service` garante "possuem serviços cadastrados";
   *   estabelecimentos sem nenhum serviço são silenciosamente excluídos.
   */
  async findByGeolocation(
    latitude: number,
    longitude: number,
    radiusKm: number,
  ): Promise<RawBusinessGeoRow[]> {
    const radiusMeters = radiusKm * 1000;

    return this.businessRepository.query<RawBusinessGeoRow[]>(
      `
        SELECT
          business.id AS id,
          business.trade_name AS trade_name,
          business.category AS category,
          business.average_rating AS average_rating,
          address.latitude AS latitude,
          address.longitude AS longitude,
          ST_Distance(
            address.location,
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
          ) / 1000 AS distance_km,
          STRING_AGG(DISTINCT service.name, ', ') AS services_summary
        FROM business
        INNER JOIN address ON address.business_id = business.id
        INNER JOIN service ON service.business_id = business.id
        WHERE
          business.deleted_at IS NULL
          AND business."visibilityStatus" = true
          AND address.location IS NOT NULL
          AND ST_DWithin(
            address.location,
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
            $3
          )
        GROUP BY business.id, address.latitude, address.longitude, address.location
        ORDER BY distance_km ASC
      `,
      [longitude, latitude, radiusMeters],
    );
  }
}
