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

export type AppointmentStatus = 'SCHEDULED' | 'CANCELLED' | 'COMPLETED';

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

  @Column({ type: 'varchar', default: 'SCHEDULED' })
  status: AppointmentStatus;

  @ManyToOne(() => User)
  client: User;

  @ManyToOne(() => Professional)
  professional: Professional;

  @ManyToOne(() => Business)
  business: Business;

  @ManyToOne(() => Service)
  service: Service;

  @CreateDateColumn()
  createdAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
