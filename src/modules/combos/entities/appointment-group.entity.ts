import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Business } from '../../businesses/entities/business.entity';
import { Appointment } from '../../appointments/entities/appointment.entity';
import { Combo } from './combo.entity';
import { NumericTransformer } from '../../../common/numeric.transformer';

export type AppointmentGroupStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'NO_SHOW';

export const ACTIVE_GROUP_STATUSES: AppointmentGroupStatus[] = [
  'PENDING',
  'CONFIRMED',
];

@Entity('appointment_groups')
export class AppointmentGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Combo, { nullable: true, onDelete: 'SET NULL' })
  combo: Combo | null;

  @Column()
  comboName: string;

  @Index()
  @ManyToOne(() => User)
  client: User;

  @Index()
  @ManyToOne(() => Business)
  business: Business;

  @Column({ type: 'date' })
  date: string;

  @Column()
  startTime: string;

  @Column()
  endTime: string;

  @Column({ type: 'varchar', default: 'PENDING' })
  status: AppointmentGroupStatus;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    transformer: NumericTransformer,
  })
  originalPrice: number;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    transformer: NumericTransformer,
  })
  finalPrice: number;

  @Column({ type: 'text', nullable: true })
  cancellationReason: string | null;

  @Column({ type: 'varchar', nullable: true })
  cancelledByRole: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  confirmedAt: Date | null;

  @OneToMany(() => Appointment, (appointment) => appointment.group)
  appointments: Appointment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  get discount(): number {
    return Number((this.originalPrice - this.finalPrice).toFixed(2));
  }
}
