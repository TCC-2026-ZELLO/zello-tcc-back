import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CatalogService } from './catalog.service';

describe('CatalogService', () => {
  let service: CatalogService;
  let serviceRepo: any;
  let bmRepo: any;
  let managerRepo: any;
  let bpRepo: any;
  let professionalsService: any;

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    serviceRepo = {
      create: jest.fn().mockImplementation((d) => ({ id: 's1', ...d })),
      save: jest.fn().mockImplementation(async (d) => d),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({
        id: 's1',
        durationMinutes: 40,
        cleanupMinutes: 10,
        business: { id: 'b1' },
      }),
      merge: jest.fn(),
    };
    bmRepo = { findOne: jest.fn().mockResolvedValue({ id: 'bm1' }) };
    managerRepo = { findOne: jest.fn().mockResolvedValue({ id: 'm1' }) };
    bpRepo = {
      find: jest.fn().mockResolvedValue([{ professional: { id: 'p1' } }]),
    };
    professionalsService = {
      revalidateVisibility: jest.fn().mockResolvedValue(undefined),
    };

    service = new CatalogService(
      serviceRepo,
      bmRepo,
      managerRepo,
      bpRepo,
      professionalsService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should create, findAllByBusiness, findOne, update, remove, and getServiceDuration', async () => {
    const created = await service.create(
      {
        name: 'Corte',
        durationMinutes: 40,
        cleanupMinutes: 10,
        price: 50,
      } as any,
      'u1',
      'b1',
    );
    expect(created.id).toBe('s1');

    await service.findAllByBusiness('b1');
    await service.update('s1', { name: 'Corte Novo' } as any);

    const removed = await service.remove('s1');
    expect(professionalsService.revalidateVisibility).toHaveBeenCalledWith(
      'p1',
    );
    expect(removed).toEqual({
      message: 'Serviço desativado e perfis revalidados com sucesso.',
    });

    const dur = await service.getServiceDuration('s1');
    expect(dur).toEqual({ totalTime: 50, duration: 40, cleanup: 10 });
  });

  it('should throw ForbiddenException when no access and NotFoundException when service missing', async () => {
    bmRepo.findOne.mockResolvedValue(null);
    await expect(service.create({} as any, 'u1', 'b1')).rejects.toThrow(
      ForbiddenException,
    );

    serviceRepo.findOne.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });
});
