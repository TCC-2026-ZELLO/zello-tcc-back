import { AppointmentsCronService } from './appointments-cron.service';

describe('AppointmentsCronService', () => {
  let cronService: AppointmentsCronService;
  let mockRepo: any;

  beforeEach(() => {
    mockRepo = {
      find: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    };
    cronService = new AppointmentsCronService(mockRepo);
  });

  it('should cancel expired PENDING appointments within 15 minutes threshold', async () => {
    mockRepo.find.mockResolvedValue([
      { id: '1', date: '2000-01-01', startTime: '10:00' }, // expired
      { id: '2', date: '2099-01-01', startTime: '10:00' }, // future
      { id: '3', date: null, startTime: null }, // invalid
    ]);

    await cronService.cancelExpiredPendingAppointments();

    expect(mockRepo.update).toHaveBeenCalledTimes(1);
    expect(mockRepo.update).toHaveBeenCalledWith('1', { status: 'CANCELLED' });
  });

  it('should mark CONFIRMED appointments as NO_SHOW when finished more than 60 mins ago', async () => {
    mockRepo.find.mockResolvedValue([
      { id: '10', date: '2000-01-01', endTime: '11:00' }, // past > 60m
      { id: '11', date: '2099-01-01', endTime: '11:00' }, // future
      { id: '12', date: null, endTime: null }, // invalid
    ]);

    await cronService.markAutoNoShowAppointments();

    expect(mockRepo.update).toHaveBeenCalledTimes(1);
    expect(mockRepo.update).toHaveBeenCalledWith('10', {
      status: 'NO_SHOW',
      cancelledByRole: 'cron_auto',
    });
  });
});
