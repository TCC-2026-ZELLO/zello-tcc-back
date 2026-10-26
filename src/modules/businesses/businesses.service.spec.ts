import {
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { BusinessesService } from './businesses.service';

describe('BusinessesService', () => {
  let service: BusinessesService;
  let businessRepo: any;
  let galleryRepo: any;
  let bmRepo: any;
  let managerRepo: any;
  let filesService: any;
  let usersService: any;
  let dataSource: any;
  let qrMock: any;

  beforeEach(() => {
    businessRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'b1',
        tradeName: 'Salão',
        photoUrl: 'old-photo',
        bannerUrl: 'old-banner',
      }),
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn().mockImplementation(async (b) => b),
      softRemove: jest.fn().mockResolvedValue(undefined),
    };
    galleryRepo = {
      create: jest.fn().mockImplementation((d) => ({ id: 'img1', ...d })),
      save: jest.fn().mockImplementation(async (d) => d),
      findOne: jest.fn().mockResolvedValue({ id: 'img1', url: 'url1' }),
      find: jest.fn().mockResolvedValue([]),
      remove: jest.fn().mockResolvedValue({ id: 'img1' }),
    };
    bmRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'bm1' }),
      find: jest.fn().mockResolvedValue([]),
    };
    managerRepo = {};
    filesService = {
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };
    usersService = {
      appendManager: jest.fn().mockResolvedValue({ id: 'm1' }),
    };

    qrMock = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        create: jest.fn().mockImplementation((_cls, d) => ({ id: 'b1', ...d })),
        save: jest.fn().mockImplementation(async (_cls, d) => d),
      },
    };
    dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(qrMock),
    };

    service = new BusinessesService(
      businessRepo,
      galleryRepo,
      bmRepo,
      managerRepo,
      filesService,
      usersService,
      dataSource,
    );
  });

  it('should updateProfile, updatePhoto, updateBanner, add/remove gallery images', async () => {
    const updated = await service.updateProfile('b1', 'u1', {
      tradeName: 'Novo Salão',
      description: 'Desc',
      visibilityStatus: true,
      timezone: 'America/Sao_Paulo',
    });
    expect(updated.profileComplete).toBe(true);

    const photoUpdated = await service.updatePhoto('b1', 'u1', 'new-photo');
    expect(filesService.deleteFile).toHaveBeenCalledWith('old-photo');
    expect(photoUpdated.photoUrl).toBe('new-photo');

    const bannerUpdated = await service.updateBanner('b1', 'u1', 'new-banner');
    expect(filesService.deleteFile).toHaveBeenCalledWith('old-banner');
    expect(bannerUpdated.bannerUrl).toBe('new-banner');

    await service.addGalleryImage('b1', 'u1', 'img-url');
    await service.removeGalleryImage('b1', 'u1', 'img1');
    await service.findGallery('b1');
    await service.findMyBusinesses('u1');
    await service.findAll();
    expect(await service.remove('b1')).toEqual({
      message: 'Empresa removida com sucesso.',
    });
  });

  it('should create business inside transaction and rollback on error', async () => {
    const created = await service.create(
      { tradeName: 'Unidade 1', timezone: 'America/Sao_Paulo' },
      { id: 'u1', email: 'a@b.com', roles: ['manager'] },
    );
    expect(created.tradeName).toBe('Unidade 1');
    expect(qrMock.commitTransaction).toHaveBeenCalled();

    usersService.appendManager.mockRejectedValue(new Error('DB fail'));
    await expect(
      service.create(
        { tradeName: 'Unidade 2' },
        { id: 'u1', email: 'a@b.com', roles: ['manager'] },
      ),
    ).rejects.toThrow(InternalServerErrorException);
    expect(qrMock.rollbackTransaction).toHaveBeenCalled();
  });

  it('should throw ForbiddenException or NotFoundException when unauthorized or missing', async () => {
    bmRepo.findOne.mockResolvedValue(null);
    await expect(service.updateProfile('b1', 'u1', {})).rejects.toThrow(
      ForbiddenException,
    );

    bmRepo.findOne.mockResolvedValue({ id: 'bm1' });
    galleryRepo.findOne.mockResolvedValue(null);
    await expect(
      service.removeGalleryImage('b1', 'u1', 'missing'),
    ).rejects.toThrow(NotFoundException);

    businessRepo.findOne.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });
});
