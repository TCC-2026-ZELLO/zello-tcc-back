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
}
