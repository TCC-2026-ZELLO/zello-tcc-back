import { BusinessGeolocationRepository } from './business-geolocation.repository';

describe('BusinessGeolocationRepository', () => {
  it('should execute PostGIS query with converted radius in meters', async () => {
    const mockRepo: any = {
      query: jest.fn().mockResolvedValue([{ id: 'b1' }]),
    };
    const repo = new BusinessGeolocationRepository(mockRepo);

    const rows = await repo.findByGeolocation(-25.42, -49.27, 5);
    expect(rows).toEqual([{ id: 'b1' }]);
    expect(mockRepo.query).toHaveBeenCalledWith(expect.any(String), [
      -49.27,
      -25.42,
      5000,
    ]);
  });
});
