import { NotFoundException } from '@nestjs/common';
import { ProfessionalsService } from './professionals.service';

describe('ProfessionalsService', () => {
  let service: ProfessionalsService;
  let professionalRepo: any;
  let portfolioRepo: any;
  let bpsRepo: any;
  let userRepo: any;
  let qualificationRepo: any;
  let filesService: any;

  beforeEach(() => {
    professionalRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'p1',
        photoUrl: 'old-avatar',
        bannerUrl: 'old-banner',
        visibilityStatus: true,
      }),
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn().mockImplementation(async (p) => p),
      softRemove: jest.fn().mockResolvedValue({ id: 'p1' }),
    };
    portfolioRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({ id: 'img1', url: 'url1' }),
      create: jest.fn().mockImplementation((d) => d),
      save: jest.fn().mockImplementation(async (d) => d),
      remove: jest.fn().mockResolvedValue({ id: 'img1' }),
    };
    bpsRepo = {
      find: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    };
    userRepo = {};
    qualificationRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 'q1', certificateUrl: 'old-cert' }),
      create: jest.fn().mockImplementation((d) => d),
      save: jest.fn().mockImplementation(async (d) => d),
      remove: jest.fn().mockResolvedValue({ id: 'q1' }),
    };
    filesService = {
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };

    service = new ProfessionalsService(
      professionalRepo,
      portfolioRepo,
      bpsRepo,
      userRepo,
      qualificationRepo,
      filesService,
    );
  });

  it('should execute profile, avatar, banner, portfolio, qualifications and visibility methods', async () => {
    await service.findPublicProfile('p1');
    await service.findProfessionalServices('p1');
    await service.findPortfolio('p1');
    await service.findAll();

    const updated = await service.updateProfile('u1', {
      bio: 'Minha bio',
      visibilityStatus: true,
      specialty: 'Barbeiro',
    });
    expect(updated.profileComplete).toBe(true);

    await service.updateAvatar('u1', 'new-avatar');
    expect(filesService.deleteFile).toHaveBeenCalledWith('old-avatar');

    await service.updateBanner('u1', 'new-banner');
    expect(filesService.deleteFile).toHaveBeenCalledWith('old-banner');

    await service.addPortfolioImage('u1', 'port-url');
    await service.removePortfolioImage('u1', 'img1');

    await service.findQualifications('p1');
    await service.addQualification(
      'u1',
      {
        title: 'Curso',
        institution: 'SENAC',
        type: 'COURSE' as any,
        year: 2024,
      },
      'cert-url',
    );
    await service.updateQualification(
      'u1',
      'q1',
      {
        title: 'Novo',
        institution: 'PUC',
        type: 'DEGREE' as any,
        year: 2025,
      },
      'new-cert-url',
    );
    await service.removeQualification('u1', 'q1');
    await service.remove('p1');
    await service.revalidateVisibility('p1');
    expect(professionalRepo.save).toHaveBeenCalled();
  });

  it('should throw NotFoundException when entities are missing', async () => {
    portfolioRepo.findOne.mockResolvedValue(null);
    await expect(service.removePortfolioImage('u1', 'missing')).rejects.toThrow(
      NotFoundException,
    );

    qualificationRepo.findOne.mockResolvedValue(null);
    await expect(
      service.updateQualification('u1', 'missing', {}),
    ).rejects.toThrow(NotFoundException);
    await expect(
      service.removeQualification('u1', 'missing'),
    ).rejects.toThrow(NotFoundException);

    professionalRepo.findOne.mockResolvedValue(null);
    await expect(service.findPublicProfile('missing')).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.updateProfile('u1', {})).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
  });
});
