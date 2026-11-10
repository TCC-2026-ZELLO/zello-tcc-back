import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appointment } from './entities/appointment.entity';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class RemindersCronService {
  private readonly logger = new Logger(RemindersCronService.name);

  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
    private readonly whatsappService: WhatsappService,
    private readonly mailerService: MailerService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async processReminders() {
    this.logger.debug('Verificando lembretes de agendamento (24h e 1h)...');

    const now = new Date();

    const pendingAppointments = await this.appointmentRepo.find({
      where: { status: 'CONFIRMED' },
      relations: ['client', 'business', 'service'],
    });

    for (const app of pendingAppointments) {
      if (!app.date || !app.startTime || !app.client) continue;

      const appDateTime = new Date(`${app.date}T${app.startTime}:00-03:00`);
      const diffMs = appDateTime.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      const {
        wantsEmailReminders,
        wantsWhatsappReminders,
        phone,
        email,
        name,
      } = app.client;

      if (
        diffHours <= 24 &&
        diffHours > 23 &&
        app.reminder24hStatus === 'PENDING'
      ) {
        await this.sendReminders(
          app,
          '24h',
          wantsEmailReminders,
          wantsWhatsappReminders,
          phone,
          email,
          name,
        );
      }

      if (
        diffHours <= 1 &&
        diffHours > 0 &&
        app.reminder1hStatus === 'PENDING'
      ) {
        await this.sendReminders(
          app,
          '1h',
          wantsEmailReminders,
          wantsWhatsappReminders,
          phone,
          email,
          name,
        );
      }

      if (
        (app.reminder24hStatus === 'FAILED' ||
          app.reminder1hStatus === 'FAILED') &&
        app.reminderRetryCount < 3
      ) {
        if (app.lastReminderAttempt) {
          const minSinceLastAttempt =
            (now.getTime() - app.lastReminderAttempt.getTime()) / (1000 * 60);
          if (minSinceLastAttempt >= 10) {
            this.logger.log(
              `Tentando reenviar lembrete para agendamento ${app.id} (Tentativa ${app.reminderRetryCount + 1})`,
            );
            const type = app.reminder24hStatus === 'FAILED' ? '24h' : '1h';
            await this.sendReminders(
              app,
              type,
              wantsEmailReminders,
              wantsWhatsappReminders,
              phone,
              email,
              name,
              true,
            );
          }
        }
      }
    }
  }

  private async sendReminders(
    app: Appointment,
    type: '24h' | '1h',
    wantsEmail: boolean,
    wantsWhatsapp: boolean,
    phone: string,
    email: string,
    clientName: string,
    isRetry = false,
  ) {
    let hasError = false;
    const msgType = type === '24h' ? 'amanhã' : 'em breve (1 hora)';
    const textMsg = `Olá, ${clientName}! Este é um lembrete automático da Zello. Seu atendimento está marcado para ${msgType} às ${app.startTime}.`;

    try {
      if (wantsWhatsapp && phone) {
        const success = await this.whatsappService.sendMessage(phone, textMsg);
        if (!success) hasError = true;
      }

      if (wantsEmail && email) {
        await this.mailerService.sendMail({
          to: email,
          subject: `Lembrete de Atendimento - ${msgType}`,
          text: textMsg,
        });
      }
    } catch (err) {
      this.logger.error(
        `Erro ao enviar lembrete ${type} para ${clientName}:`,
        err,
      );
      hasError = true;
    }

    const statusField =
      type === '24h' ? 'reminder24hStatus' : 'reminder1hStatus';

    if (hasError) {
      await this.appointmentRepo.update(app.id, {
        [statusField]: 'FAILED',
        lastReminderAttempt: new Date(),
        reminderRetryCount: isRetry ? app.reminderRetryCount + 1 : 0,
      });
    } else {
      await this.appointmentRepo.update(app.id, {
        [statusField]: 'SENT',
        lastReminderAttempt: new Date(),
      });
    }
  }
}
