import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { Appointment } from './entities/appointment.entity';

@Injectable()
export class AppointmentsCronService {
  private readonly logger = new Logger(AppointmentsCronService.name);

  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
  ) {}

  // Roda a cada minuto para verificar agendamentos expirados
  @Cron(CronExpression.EVERY_MINUTE)
  async cancelExpiredPendingAppointments() {
    this.logger.debug(
      'Executando cron de expiração de agendamentos pendentes...',
    );

    const now = new Date();
    // O prazo limite passa a ser 15 minutos antes do agendamento.
    // Se faltar 15 minutos (ou menos) para o horário e ainda não foi confirmado, expira automaticamente.
    const thresholdDate = new Date(now.getTime() + 15 * 60 * 1000);

    // Na nossa base, date é um string YYYY-MM-DD e startTime é HH:mm
    // Buscamos PENDING.
    const pendingAppointments = await this.appointmentRepo.find({
      where: { status: 'PENDING' },
    });

    for (const app of pendingAppointments) {
      if (!app.date || !app.startTime) continue;

      // Ajuste devido a fuso horário. Se o app.date for a data local,
      // precisaremos considerar o offset de -3h (Brasil).
      const appDateTime = new Date(`${app.date}T${app.startTime}:00-03:00`);

      if (thresholdDate >= appDateTime) {
        this.logger.log(
          `Cancelando agendamento ${app.id} por expiração de tempo.`,
        );
        await this.appointmentRepo.update(app.id, { status: 'CANCELLED' });
      }
    }
  }

  // Roda a cada 5 minutos para marcar NO_SHOW automático em agendamentos finalizados há mais de 60 minutos
  @Cron('*/5 * * * *')
  async markAutoNoShowAppointments() {
    this.logger.debug(
      'Executando cron de verificação de no-show automático...',
    );

    const now = new Date();
    // A margem é de 60 minutos APÓS o horário de fim do serviço.
    const marginMs = 60 * 60 * 1000; 
    const thresholdDate = new Date(now.getTime() - marginMs);

    const confirmedAppointments = await this.appointmentRepo.find({
      where: { status: 'CONFIRMED' },
    });

    for (const app of confirmedAppointments) {
      if (!app.date || !app.endTime) continue;

      const appEndDateTime = new Date(`${app.date}T${app.endTime}:00-03:00`);

      // Se thresholdDate for maior que o horário de término do serviço, significa que
      // já se passaram mais de 60 minutos desde o fim.
      if (thresholdDate >= appEndDateTime) {
        this.logger.log(
          `Marcando agendamento ${app.id} como NO_SHOW automático (sem alterar reputação).`,
        );
        await this.appointmentRepo.update(app.id, { 
          status: 'NO_SHOW',
          cancelledByRole: 'cron_auto',
        });
      }
    }
  }
}
