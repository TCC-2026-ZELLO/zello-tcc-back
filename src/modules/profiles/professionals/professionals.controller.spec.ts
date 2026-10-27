import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ProfessionalsController } from './professionals.controller';
import { ProfessionalsService } from './professionals.service';
import { FilesService } from '../../files/files.service';

describe('ProfessionalsController', () => {
  let controller: ProfessionalsController;
  let service: any;
  let filesService: any;

  beforeEach(async () => {
    service = {
      updateProfile: jest.fn().mockResolvedValue({ id: 'p1' }),
      updateAvatar: jest.fn().mockResolvedValue({ id: 'p1' }),
      updateBanner: jest.fn().mockResolvedValue({ id: 'p1' }),
      addPortfolioImage: jest.fn().mockResolvedValue({ id: 'img1' }),
      removePortfolioImage: jest.fn().mockResolvedValue({ id: 'img1' }),
      addQualification: jest.fn().mockResolvedValue({ id: 'q1' }),
      updateQualification: jest.fn().mockResolvedValue({ id: 'q1' }),
      removeQualification: jest.fn().mockResolvedValue({ id: 'q1' }),
      findPublicProfile: jest.fn().mockResolvedValue({ id: 'p1' }),
      findProfessionalServices: jest.fn().mockResolvedValue([]),
      findPortfolio: jest.fn().mockResolvedValue([]),
      findQualifications: jest.fn().mockResolvedValue([]),
      findAll: jest.fn().mockResolvedValue([]),
      remove: jest.fn().mockResolvedValue({ id: 'p1' }),
    };
    filesService = {
      uploadPublicFile: jest.fn().mockResolvedValue('https://cdn/file.pdf'),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProfessionalsController],
      providers: [
        { provide: ProfessionalsService, useValue: service },
        { provide: FilesService, useValue: filesService },
      ],
    }).compile();

    controller = module.get<ProfessionalsController>(ProfessionalsController);
  });

  it('should be defined and delegate all endpoints', async () => {
    const req = {
      user: { id: 'u1', email: 'a@b.com', roles: ['professional'] },
    };

    expect(await controller.updateProfile(req, {})).toEqual({ id: 'p1' });
    expect(await controller.updateAvatar(req, {})).toEqual({ id: 'p1' });
    expect(await controller.updateBanner(req, {})).toEqual({ id: 'p1' });
    expect(await controller.addPortfolioImage(req, {})).toEqual({ id: 'img1' });
    expect(await controller.removePortfolioImage(req, 'img1')).toEqual({
      id: 'img1',
    });

    await expect(
      controller.addQualification(req, undefined as any, {} as any),
    ).rejects.toThrow(BadRequestException);

    expect(
      await controller.addQualification(req, {} as any, {} as any),
    ).toEqual({ id: 'q1' });
    expect(
      await controller.updateQualification(req, 'q1', {} as any, {}),
    ).toEqual({ id: 'q1' });
    expect(
      await controller.updateQualification(req, 'q1', undefined as any, {}),
    ).toEqual({ id: 'q1' });
    expect(await controller.removeQualification(req, 'q1')).toEqual({
      id: 'q1',
    });

    expect(await controller.findOne('p1')).toEqual({ id: 'p1' });
    expect(await controller.findServices('p1')).toEqual([]);
    expect(await controller.findPortfolio('p1')).toEqual([]);
    expect(await controller.findQualifications('p1')).toEqual([]);
    expect(await controller.findAll()).toEqual([]);
    expect(await controller.remove('p1')).toEqual({ id: 'p1' });
  });
});
