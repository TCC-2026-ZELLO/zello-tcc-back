import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Professional } from '../../profiles/professionals/entities/professional.entity';
import { Business } from '../../businesses/entities/business.entity';
import { Appointment } from '../../appointments/entities/appointment.entity';

export enum ReviewTargetType {
  PROFESSIONAL = 'PROFESSIONAL',
  BUSINESS = 'BUSINESS',
}

@Entity('reviews')
@Unique(['appointment', 'targetType']) // Uma avaliação do mesmo tipo por agendamento
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int' })
  rating: number;

  @Column({ type: 'text' })
  comment: string;

  @Column({
    type: 'enum',
    enum: ReviewTargetType,
  })
  targetType: ReviewTargetType;

  @ManyToOne(() => Appointment)
  @JoinColumn({ name: 'appointment_id' })
  appointment: Appointment;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'client_id' })
  client: User;

  @ManyToOne(() => Professional, { nullable: true })
  @JoinColumn({ name: 'professional_id' })
  professional: Professional;

  @ManyToOne(() => Business, { nullable: true })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
