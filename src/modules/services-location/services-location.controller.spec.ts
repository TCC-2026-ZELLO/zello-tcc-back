import { Test, TestingModule } from '@nestjs/testing';
import { ServicesLocationController } from './services-location.controller';
import { SearchServicesByLocationService } from './search-services-by-location.service';

describe('ServicesLocationController', () => {
  let controller: ServicesLocationController;
  let service: { findServicesByLocation: jest.Mock };

  beforeEach(async () => {
    service = { findServicesByLocation: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ServicesLocationController],
      providers: [{ provide: SearchServicesByLocationService, useValue: service }],
    }).compile();

    controller = module.get(ServicesLocationController);
  });

  it('repassa latitude/longitude do DTO ao service (apenas orquestração)', async () => {
    service.findServicesByLocation.mockResolvedValue({ data: [], total: 0, message: 'Nenhum prestador encontrado no raio de 10km' });

    await controller.findByLocation({ latitude: -25.4284, longitude: -49.2733 });

    expect(service.findServicesByLocation).toHaveBeenCalledWith(-25.4284, -49.2733);
  });

  it('envolve o resultado do service com o status HTTP 200', async () => {
    service.findServicesByLocation.mockResolvedValue({
      data: [
        {
          id: 'prof-123',
          name: 'Estética Bella',
          latitude: -25.4284,
          longitude: -49.2733,
          rating: 4.8,
          category: 'Salão de Beleza',
          services: 'Cabelo, Manicure, Pedicure',
          distanceKm: 3.2,
        },
      ],
      total: 1,
    });

    const result = await controller.findByLocation({ latitude: -25.4284, longitude: -49.2733 });

    expect(result).toEqual({
      status: 200,
      data: [
        {
          id: 'prof-123',
          name: 'Estética Bella',
          latitude: -25.4284,
          longitude: -49.2733,
          rating: 4.8,
          category: 'Salão de Beleza',
          services: 'Cabelo, Manicure, Pedicure',
          distanceKm: 3.2,
        },
      ],
      total: 1,
    });
  });
});
