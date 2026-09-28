import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Appointment } from './appointment.entity';

export type RescheduleInitiator = 'CLIENT' | 'MANAGER';

@Entity('appointment_reschedules')
export class AppointmentReschedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => Appointment, { onDelete: 'CASCADE' })
  appointment: Appointment;

  @Column({ type: 'date' })
  fromDate: string;

  @Column()
  fromStartTime: string;

  @Column()
  fromEndTime: string;

  @Column({ type: 'date' })
  toDate: string;

  @Column()
  toStartTime: string;

  @Column()
  toEndTime: string;

  @Column({ type: 'varchar' })
  initiatedBy: RescheduleInitiator;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  actor: User | null;

  @CreateDateColumn()
  createdAt: Date;
}
