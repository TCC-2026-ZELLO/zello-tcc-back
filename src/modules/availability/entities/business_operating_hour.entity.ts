import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Business } from '../../businesses/entities/business.entity';

@Entity('business_operating_hour')
export class BusinessOperatingHour {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('int')
  dayOfWeek: number;

  @Column('time')
  startTime: string;

  @Column('time')
  endTime: string;

  @Column('boolean', { default: true })
  isOpen: boolean;

  @ManyToOne(() => Business)
  @JoinColumn({ name: 'business_id' })
  business: Business;
}
