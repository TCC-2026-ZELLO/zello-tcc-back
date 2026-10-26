import { Test, TestingModule } from '@nestjs/testing';
import { BusinessesController } from './businesses.controller';
import { BusinessesService } from './businesses.service';
import { FilesService } from '../files/files.service';

describe('BusinessesController', () => {
  let controller: BusinessesController;
  let service: any;
  let filesService: any;

  beforeEach(async () => {
    service = {
      updateProfile: jest.fn().mockResolvedValue({ id: 'b1' }),
      updatePhoto: jest.fn().mockResolvedValue({ id: 'b1' }),
      updateBanner: jest.fn().mockResolvedValue({ id: 'b1' }),
      addGalleryImage: jest.fn().mockResolvedValue({ id: 'img1' }),
      removeGalleryImage: jest.fn().mockResolvedValue({ id: 'img1' }),
      findMyBusinesses: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({ id: 'b1' }),
      findGallery: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'b1' }),
      findAll: jest.fn().mockResolvedValue([]),
      remove: jest.fn().mockResolvedValue({ message: 'ok' }),
    };
    filesService = {
      uploadPublicFile: jest.fn().mockResolvedValue('https://cdn/file.jpg'),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BusinessesController],
      providers: [
        { provide: BusinessesService, useValue: service },
        { provide: FilesService, useValue: filesService },
      ],
    }).compile();

    controller = module.get<BusinessesController>(BusinessesController);
  });

  it('should be defined and delegate all endpoints', async () => {
    const req = { user: { id: 'u1', email: 'a@b.com', roles: ['manager'] } };
    expect(await controller.updateProfile('b1', req, {})).toEqual({ id: 'b1' });
    expect(await controller.updatePhoto('b1', req, {})).toEqual({ id: 'b1' });
    expect(await controller.updateBanner('b1', req, {})).toEqual({ id: 'b1' });
    expect(await controller.addGalleryImage('b1', req, {})).toEqual({
      id: 'img1',
    });
    expect(await controller.removeGalleryImage('b1', 'img1', req)).toEqual({
      id: 'img1',
    });
    expect(await controller.findMyBusinesses(req)).toEqual([]);
    expect(await controller.findOne('b1')).toEqual({ id: 'b1' });
    expect(await controller.findGallery('b1')).toEqual([]);
    expect(await controller.create(req, { tradeName: 'Salão' })).toEqual({
      id: 'b1',
    });
    expect(await controller.findAll()).toEqual([]);
    expect(await controller.remove('b1')).toEqual({ message: 'ok' });
  });
});
