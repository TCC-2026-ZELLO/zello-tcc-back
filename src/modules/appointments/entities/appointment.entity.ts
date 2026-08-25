import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Business } from '../../businesses/entities/business.entity';
import { Service } from '../../catalog/entities/service.entity';
import { Professional } from '../../profiles/professionals/entities/professional.entity';

export type AppointmentStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'NO_SHOW'
  | 'COMPLETED';

@Entity('appointments')
export class Appointment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  date: string;

  @Column()
  startTime: string;

  @Column()
  endTime: string;

  @Column({ type: 'varchar', default: 'PENDING' })
  status: AppointmentStatus;

  @ManyToOne(() => User)
  client: User;

  @ManyToOne(() => Professional)
  professional: Professional;

  @ManyToOne(() => Business)
  business: Business;

  @ManyToOne(() => Service)
  service: Service;

  @Column({ type: 'text', nullable: true })
  cancellationReason: string | null;

  @Column({ type: 'varchar', nullable: true })
  cancelledByRole: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  confirmedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
