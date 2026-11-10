import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BusinessProfessional } from '../../business-professionals/entities/business-professional.entity';

@Entity('professional_shift')
export class ProfessionalShift {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('int')
  dayOfWeek: number;

  @Column('time')
  startTime: string;

  @Column('time')
  endTime: string;

  @ManyToOne(() => BusinessProfessional)
  @JoinColumn({ name: 'business_professional_id' })
  businessProfessional: BusinessProfessional;
}
