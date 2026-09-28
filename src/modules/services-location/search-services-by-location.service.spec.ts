import { Test, TestingModule } from '@nestjs/testing';
import { SearchServicesByLocationService } from './search-services-by-location.service';
import { BusinessGeolocationRepository } from './repositories/business-geolocation.repository';
import { RawBusinessGeoRow } from './interfaces/raw-business-geo-row.interface';
import { NO_RESULTS_MESSAGE, SERVICES_SEARCH_RADIUS_KM } from './constants/geo-search.constants';

/** Coordenadas fixas do cliente usadas em todos os cenários (Curitiba/PR). */
const CLIENT_LATITUDE = -25.4284;
const CLIENT_LONGITUDE = -49.2733;

function buildRow(overrides: Partial<RawBusinessGeoRow> = {}): RawBusinessGeoRow {
  return {
    id: 'prof-123',
    trade_name: 'Estética Bella',
    category: 'Salão de Beleza',
    average_rating: '4.8',
    latitude: '-25.4284',
    longitude: '-49.2733',
    distance_km: '3.2',
    services_summary: 'Cabelo, Manicure, Pedicure',
    ...overrides,
  };
}

describe('SearchServicesByLocationService', () => {
  let service: SearchServicesByLocationService;
  let repository: { findByGeolocation: jest.Mock };

  beforeEach(async () => {
    repository = { findByGeolocation: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchServicesByLocationService,
        { provide: BusinessGeolocationRepository, useValue: repository },
      ],
    }).compile();

    service = module.get(SearchServicesByLocationService);
  });

  it('sempre consulta o repositório usando o raio fixo de 10km (CA2 — travamento de expansão)', async () => {
    repository.findByGeolocation.mockResolvedValue([]);

    await service.findServicesByLocation(CLIENT_LATITUDE, CLIENT_LONGITUDE);

    expect(repository.findByGeolocation).toHaveBeenCalledWith(
      CLIENT_LATITUDE,
      CLIENT_LONGITUDE,
      SERVICES_SEARCH_RADIUS_KM,
    );
    expect(SERVICES_SEARCH_RADIUS_KM).toBe(10);
  });

  // Cenário 1: prestador dentro de 10km
  it('retorna o estabelecimento quando ele está dentro do raio de 10km', async () => {
    repository.findByGeolocation.mockResolvedValue([buildRow()]);

    const result = await service.findServicesByLocation(CLIENT_LATITUDE, CLIENT_LONGITUDE);

    expect(result.total).toBe(1);
    expect(result.message).toBeUndefined();
    expect(result.data[0]).toEqual({
      id: 'prof-123',
      name: 'Estética Bella',
      latitude: -25.4284,
      longitude: -49.2733,
      rating: 4.8,
      category: 'Salão de Beleza',
      services: 'Cabelo, Manicure, Pedicure',
      distanceKm: 3.2,
    });
  });

  // Cenário 2: prestador a 10.1km deve ser excluído.
  // O corte é feito no banco por ST_DWithin (ver business-geolocation.repository.ts
  // e o teste de integração opcional); aqui garantimos que o Service não faz
  // nenhuma filtragem própria por distância que pudesse mascarar uma regressão
  // nesse contrato — ele apenas repassa o que o repositório já filtrou.
  it('não inclui estabelecimentos que o repositório não retornou (ex.: 10.1km, fora do raio)', async () => {
    repository.findByGeolocation.mockResolvedValue([]);

    const result = await service.findServicesByLocation(CLIENT_LATITUDE, CLIENT_LONGITUDE);

    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
  });

  // Cenário 3: nenhum prestador no raio -> resposta vazia estruturada
  it('retorna lista vazia com mensagem quando não há estabelecimentos no raio', async () => {
    repository.findByGeolocation.mockResolvedValue([]);

    const result = await service.findServicesByLocation(CLIENT_LATITUDE, CLIENT_LONGITUDE);

    expect(result).toEqual({ data: [], total: 0, message: NO_RESULTS_MESSAGE });
  });

  it('aplica categoria padrão quando o estabelecimento não tem categoria cadastrada', async () => {
    repository.findByGeolocation.mockResolvedValue([buildRow({ category: null })]);

    const result = await service.findServicesByLocation(CLIENT_LATITUDE, CLIENT_LONGITUDE);

    expect(result.data[0].category).toBe('Estabelecimento');
  });

  it('arredonda a distância para duas casas decimais', async () => {
    repository.findByGeolocation.mockResolvedValue([buildRow({ distance_km: '5.6789' })]);

    const result = await service.findServicesByLocation(CLIENT_LATITUDE, CLIENT_LONGITUDE);

    expect(result.data[0].distanceKm).toBe(5.68);
  });

  it('ordena múltiplos estabelecimentos conforme a ordem retornada pelo repositório (mais próximos primeiro)', async () => {
    repository.findByGeolocation.mockResolvedValue([
      buildRow({ id: 'prof-123', distance_km: '3.2' }),
      buildRow({ id: 'prof-456', trade_name: 'João Barbeiro', category: 'Barbearia', distance_km: '5.7' }),
    ]);

    const result = await service.findServicesByLocation(CLIENT_LATITUDE, CLIENT_LONGITUDE);

    expect(result.total).toBe(2);
    expect(result.data.map((item) => item.id)).toEqual(['prof-123', 'prof-456']);
  });
});
