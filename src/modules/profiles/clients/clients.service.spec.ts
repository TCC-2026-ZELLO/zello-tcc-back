import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ClientsService } from './clients.service';

describe('ClientsService', () => {
  let service: ClientsService;
  let clientRepo: any;

  beforeEach(() => {
    clientRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({ id: 'c1' }),
      merge: jest.fn(),
      save: jest.fn().mockImplementation(async (c) => c),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    service = new ClientsService(clientRepo);
  });

  it('should throw BadRequestException on create and execute findAll, findOne, update, remove', async () => {
    expect(() => service.create()).toThrow(BadRequestException);
    expect(await service.findAll()).toEqual([]);
    expect(await service.findOne('c1')).toEqual({ id: 'c1' });
    expect(await service.update('c1', {} as any)).toEqual({ id: 'c1' });
    expect(await service.remove('c1')).toEqual({
      message: 'Perfil de cliente removido com sucesso.',
    });

    clientRepo.findOne.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });
});
