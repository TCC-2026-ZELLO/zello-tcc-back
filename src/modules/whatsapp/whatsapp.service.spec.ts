import { WhatsappService } from './whatsapp.service';
import * as qrcode from 'qrcode-terminal';

const eventHandlers: Record<string, (...args: any[]) => void> = {};
const mockInitialize = jest.fn().mockResolvedValue(undefined);
const mockGetNumberId = jest.fn();
const mockSendMessage = jest.fn();

jest.mock('whatsapp-web.js', () => ({
  Client: jest.fn().mockImplementation(() => ({
    on: jest.fn((event: string, cb: (...args: any[]) => void) => {
      eventHandlers[event] = cb;
    }),
    initialize: mockInitialize,
    getNumberId: mockGetNumberId,
    sendMessage: mockSendMessage,
  })),
  LocalAuth: jest.fn(),
}));

jest.mock('qrcode-terminal', () => ({
  generate: jest.fn(),
}));

describe('WhatsappService', () => {
  let service: WhatsappService;

  const originalEnabled = process.env.WHATSAPP_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.WHATSAPP_ENABLED = 'true';
    service = new WhatsappService();
  });

  afterAll(() => {
    process.env.WHATSAPP_ENABLED = originalEnabled;
  });

  it('should stay disabled unless WHATSAPP_ENABLED=true (v5.0.0-15.2.5)', async () => {
    process.env.WHATSAPP_ENABLED = 'false';
    service.onModuleInit();
    expect(mockInitialize).not.toHaveBeenCalled();
    expect(await service.sendMessage('41999999999', 'Olá')).toBe(false);
  });

  it('should initialize client and handle events onModuleInit', () => {
    service.onModuleInit();

    eventHandlers['qr']?.('fake-qr');
    expect(qrcode.generate).toHaveBeenCalledWith('fake-qr', { small: true });

    eventHandlers['authenticated']?.();
    eventHandlers['auth_failure']?.('fail');
    eventHandlers['ready']?.();
    expect(mockInitialize).toHaveBeenCalled();
  });

  it('should return false when client is not ready', async () => {
    expect(await service.sendMessage('41999999999', 'Olá')).toBe(false);
  });

  it('should format Brazilian phone number, resolve numberId and send message when ready', async () => {
    service.onModuleInit();
    eventHandlers['ready']?.();

    mockGetNumberId.mockResolvedValue({
      _serialized: '5541999999999@c.us',
    });
    mockSendMessage.mockResolvedValue({});

    const sent = await service.sendMessage('(41) 99999-9999', 'Teste');
    expect(sent).toBe(true);
    expect(mockGetNumberId).toHaveBeenCalledWith('5541999999999@c.us');
    expect(mockSendMessage).toHaveBeenCalledWith(
      '5541999999999@c.us',
      'Teste',
    );
  });

  it('should return false when number has no active WhatsApp or sendMessage throws', async () => {
    service.onModuleInit();
    eventHandlers['ready']?.();

    mockGetNumberId.mockResolvedValue(null);
    expect(await service.sendMessage('41999999999', 'Teste')).toBe(false);

    mockGetNumberId.mockResolvedValue({ _serialized: '5541999999999@c.us' });
    mockSendMessage.mockRejectedValue(new Error('Send error'));
    expect(await service.sendMessage('41999999999', 'Teste')).toBe(false);
  });
});
