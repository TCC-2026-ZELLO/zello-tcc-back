import { RemindersCronService } from './reminders.cron.service';

describe('RemindersCronService', () => {
  let service: RemindersCronService;
  let mockRepo: any;
  let mockWhatsapp: any;
  let mockMailer: any;

  beforeEach(() => {
    mockRepo = {
      find: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    };
    mockWhatsapp = {
      sendMessage: jest.fn().mockResolvedValue(true),
    };
    mockMailer = {
      sendMail: jest.fn().mockResolvedValue(true),
    };
    service = new RemindersCronService(mockRepo, mockWhatsapp, mockMailer);
  });

  const formatBrDateAndTime = (offsetMinutes: number) => {
    const target = new Date(Date.now() + offsetMinutes * 60 * 1000);
    // Shift by -3h to get BRT components
    const brt = new Date(target.getTime() - 3 * 60 * 60 * 1000);
    const date = brt.toISOString().split('T')[0];
    const startTime = brt.toISOString().split('T')[1].substring(0, 5);
    return { date, startTime };
  };

  it('should send 24h and 1h reminders and mark SENT', async () => {
    const slot24h = formatBrDateAndTime(23.5 * 60);
    const slot1h = formatBrDateAndTime(30);

    mockRepo.find.mockResolvedValue([
      {
        id: 'app-24h',
        ...slot24h,
        reminder24hStatus: 'PENDING',
        reminder1hStatus: 'PENDING',
        reminderRetryCount: 0,
        client: {
          name: 'Ana',
          email: 'ana@zello.com',
          phone: '41999999999',
          wantsEmailReminders: true,
          wantsWhatsappReminders: true,
        },
      },
      {
        id: 'app-1h',
        ...slot1h,
        reminder24hStatus: 'SENT',
        reminder1hStatus: 'PENDING',
        reminderRetryCount: 0,
        client: {
          name: 'Beto',
          email: 'beto@zello.com',
          phone: '41988888888',
          wantsEmailReminders: true,
          wantsWhatsappReminders: true,
        },
      },
    ]);

    await service.processReminders();

    expect(mockWhatsapp.sendMessage).toHaveBeenCalledTimes(2);
    expect(mockMailer.sendMail).toHaveBeenCalledTimes(2);
    expect(mockRepo.update).toHaveBeenCalledWith(
      'app-24h',
      expect.objectContaining({ reminder24hStatus: 'SENT' }),
    );
    expect(mockRepo.update).toHaveBeenCalledWith(
      'app-1h',
      expect.objectContaining({ reminder1hStatus: 'SENT' }),
    );
  });

  it('should retry failed reminders after 10 minutes and mark FAILED if error occurs', async () => {
    const slotFuture = formatBrDateAndTime(5 * 60);
    mockWhatsapp.sendMessage.mockResolvedValue(false);

    mockRepo.find.mockResolvedValue([
      {
        id: 'app-retry',
        ...slotFuture,
        reminder24hStatus: 'FAILED',
        reminder1hStatus: 'PENDING',
        reminderRetryCount: 1,
        lastReminderAttempt: new Date(Date.now() - 15 * 60 * 1000),
        client: {
          name: 'Carlos',
          email: 'carlos@zello.com',
          phone: '41977777777',
          wantsEmailReminders: false,
          wantsWhatsappReminders: true,
        },
      },
    ]);

    await service.processReminders();

    expect(mockRepo.update).toHaveBeenCalledWith(
      'app-retry',
      expect.objectContaining({
        reminder24hStatus: 'FAILED',
        reminderRetryCount: 2,
      }),
    );
  });
});
