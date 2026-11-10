import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { BusinessManagersService } from './business-managers.service';

describe('BusinessManagersService', () => {
  let service: BusinessManagersService;
  let bmRepo: any;
  let managerRepo: any;

  beforeEach(() => {
    bmRepo = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation((d) => ({ id: 'bm1', ...d })),
      save: jest.fn().mockImplementation(async (d) => d),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    managerRepo = {
      findOne: jest.fn(),
    };
    service = new BusinessManagersService(bmRepo, managerRepo);
  });

  it('should create link as admin or authorized manager', async () => {
    bmRepo.findOne.mockResolvedValue(null);
    const createdByAdmin = await service.create(
      { managerId: 'm2', businessId: 'b1' },
      { id: 'u-admin', email: 'a@b.com', roles: ['admin'] },
    );
    expect(createdByAdmin.id).toBe('bm1');

    managerRepo.findOne.mockResolvedValue({ id: 'm1' });
    bmRepo.findOne
      .mockResolvedValueOnce({ id: 'auth-link' })
      .mockResolvedValueOnce(null);

    const createdByMgr = await service.create(
      { managerId: 'm2', businessId: 'b1' },
      { id: 'u-mgr', email: 'm@b.com', roles: ['manager'] },
    );
    expect(createdByMgr.id).toBe('bm1');
  });

  it('should throw ForbiddenException or ConflictException on invalid create', async () => {
    managerRepo.findOne.mockResolvedValue(null);
    await expect(
      service.create(
        { managerId: 'm2', businessId: 'b1' },
        { id: 'u1', email: 'a@b.com', roles: ['manager'] },
      ),
    ).rejects.toThrow(ForbiddenException);

    managerRepo.findOne.mockResolvedValue({ id: 'm1' });
    bmRepo.findOne.mockResolvedValue(null);
    await expect(
      service.create(
        { managerId: 'm2', businessId: 'b1' },
        { id: 'u1', email: 'a@b.com', roles: ['manager'] },
      ),
    ).rejects.toThrow(ForbiddenException);

    bmRepo.findOne.mockResolvedValue({ id: 'existing' });
    await expect(
      service.create(
        { managerId: 'm2', businessId: 'b1' },
        { id: 'u1', email: 'a@b.com', roles: ['admin'] },
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('should remove, findAll, findOne, and findByBusiness', async () => {
    bmRepo.findOne.mockResolvedValue({
      id: 'bm1',
      business: { id: 'b1' },
    });
    expect(
      await service.remove('bm1', {
        id: 'u1',
        email: 'a@b.com',
        roles: ['admin'],
      }),
    ).toEqual({ message: 'Vínculo de gestão removido com sucesso.' });

    managerRepo.findOne.mockResolvedValue({ id: 'm1' });
    bmRepo.findOne
      .mockResolvedValueOnce({ id: 'bm1', business: { id: 'b1' } })
      .mockResolvedValueOnce(null);

    await expect(
      service.remove('bm1', {
        id: 'u1',
        email: 'a@b.com',
        roles: ['manager'],
      }),
    ).rejects.toThrow(ForbiddenException);

    await service.findAll();
    await service.findByBusiness('b1');

    bmRepo.findOne.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });
});
