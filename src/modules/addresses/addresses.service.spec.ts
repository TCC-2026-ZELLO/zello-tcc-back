import { AddressesService } from './addresses.service';

describe('AddressesService', () => {
  let service: AddressesService;
  let mockRepo: any;
  let mockManager: any;

  beforeEach(() => {
    mockManager = {
      create: jest.fn().mockImplementation((_cls, data) => data),
      save: jest.fn().mockImplementation(async (data) => ({ id: 'addr-1', ...data })),
      query: jest.fn().mockResolvedValue(undefined),
    };
    mockRepo = {
      manager: mockManager,
      findOne: jest.fn().mockResolvedValue({ id: 'addr-1' }),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    service = new AddressesService(mockRepo);
  });

  it('should create address for business and sync location when lat/lng present', async () => {
    const res = await service.createForBusiness('b1', {
      street: 'Rua 1',
      latitude: -25.42,
      longitude: -49.27,
    });

    expect(res.id).toBe('addr-1');
    expect(mockManager.query).toHaveBeenCalledWith(
      expect.stringContaining('ST_SetSRID'),
      [-49.27, -25.42, 'addr-1'],
    );
  });

  it('should create address for user without syncing location if lat/lng are missing', async () => {
    const res = await service.createForUser('u1', { street: 'Rua 2' });

    expect(res.id).toBe('addr-1');
    expect(mockManager.query).not.toHaveBeenCalled();
  });

  it('should find by businessId and userId', async () => {
    await service.findByBusinessId('b1');
    expect(mockRepo.findOne).toHaveBeenCalledWith({
      where: { business: { id: 'b1' } },
    });

    await service.findByUserId('u1');
    expect(mockRepo.findOne).toHaveBeenCalledWith({
      where: { user: { id: 'u1' } },
    });
  });

  it('should update address and sync location', async () => {
    const res = await service.update('addr-1', {
      latitude: -25.4,
      longitude: -49.2,
    });

    expect(mockRepo.update).toHaveBeenCalledWith('addr-1', {
      latitude: -25.4,
      longitude: -49.2,
    });
    expect(mockManager.query).toHaveBeenCalled();
    expect(res).toEqual({ id: 'addr-1' });
  });
});
