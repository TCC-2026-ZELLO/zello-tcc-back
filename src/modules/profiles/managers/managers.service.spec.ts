import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ManagersService } from './managers.service';

describe('ManagersService', () => {
  let service: ManagersService;
  let managerRepo: any;

  beforeEach(() => {
    managerRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({ id: 'm1' }),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    service = new ManagersService(managerRepo);
  });

  it('should throw BadRequestException on create and update, and execute findAll, findOne, remove', async () => {
    expect(() => service.create()).toThrow(BadRequestException);
    expect(() => service.update('m1')).toThrow(BadRequestException);
    expect(await service.findAll()).toEqual([]);
    expect(await service.findOne('m1')).toEqual({ id: 'm1' });
    expect(await service.remove('m1')).toEqual({
      message: 'Perfil de gerente removido com sucesso.',
    });

    managerRepo.findOne.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });
});
