import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Client, LocalAuth } from 'whatsapp-web.js';
import * as qrcode from 'qrcode-terminal';

@Injectable()
export class WhatsappService implements OnModuleInit {
  private client: Client;
  private isReady = false;
  private readonly logger = new Logger(WhatsappService.name);

  onModuleInit() {
    this.client = new Client({
      authStrategy: new LocalAuth({ clientId: 'zello-backend' }),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
    });

    this.client.on('qr', (qr) => {
      this.logger.log('Escaneie o QR Code abaixo para conectar o WhatsApp:');
      qrcode.generate(qr, { small: true });
    });

    this.client.on('ready', () => {
      this.isReady = true;
      this.logger.log('Cliente do WhatsApp está pronto!');
    });

    this.client.on('authenticated', () => {
      this.logger.log('WhatsApp autenticado com sucesso!');
    });

    this.client.on('auth_failure', (msg) => {
      this.logger.error('Falha na autenticação do WhatsApp', msg);
    });

    this.client.initialize();
  }

  async sendMessage(to: string, message: string): Promise<boolean> {
    if (!this.isReady) {
      this.logger.warn(
        'Tentativa de envio de mensagem falhou: WhatsApp não está pronto.',
      );
      return false;
    }

    try {
      // O formato do número no whatsapp-web.js precisa ser: 5511999999999@c.us
      let cleanNumber = to.replace(/\D/g, '');
      // Se o número tiver 10 ou 11 dígitos, provavelmente é do Brasil sem o +55. Adiciona o 55 para evitar enviar para outro país!
      if (cleanNumber.length === 10 || cleanNumber.length === 11) {
        cleanNumber = '55' + cleanNumber;
      }
      const formattedNumber = `${cleanNumber}@c.us`;
      // Busca o ID real do usuário no WhatsApp (resolve problemas com o 9 dígito no Brasil e evita o erro 'No LID for user')
      const numberId = await this.client.getNumberId(formattedNumber);
      if (!numberId) {
        this.logger.warn(
          `O número ${formattedNumber} não possui WhatsApp ativo.`,
        );
        return false;
      }

      await this.client.sendMessage(numberId._serialized, message);
      this.logger.log(`Mensagem enviada com sucesso para ${to}`);
      return true;
    } catch (error) {
      this.logger.error(`Erro ao enviar mensagem para ${to}:`, error);
      return false;
    }
  }
}
