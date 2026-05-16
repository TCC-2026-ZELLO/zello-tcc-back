import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Business } from '../../businesses/entities/business.entity';
import { Professional } from '../../profiles/professionals/entities/professional.entity';

@Entity('schedule_exception')
export class ScheduleException {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('date')
  date: string;

  @Column('time', { nullable: true })
  startTime: string;

  @Column('time', { nullable: true })
  endTime: string;

  @Column('text')
  reason: string;

  @ManyToOne(() => Business, { nullable: true })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @ManyToOne(() => Professional, { nullable: true })
  @JoinColumn({ name: 'professional_id' })
  professional: Professional;
}
