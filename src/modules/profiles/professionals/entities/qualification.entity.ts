import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { Professional } from './professional.entity';

export enum QualificationType {
  DIPLOMA = 'diploma',
  SPECIALIZATION = 'specialization',
  COURSE = 'course',
  CERTIFICATION = 'certification',
}

@Entity('qualification')
export class Qualification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  institution: string;

  @Column({
    type: 'enum',
    enum: QualificationType,
    default: QualificationType.CERTIFICATION,
  })
  type: QualificationType;

  @Column({ type: 'int', nullable: true })
  year: number;

  @Column({ name: 'certificate_url', type: 'text' })
  certificateUrl: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Professional, (pro) => pro.qualifications, {
    onDelete: 'CASCADE',
  })
  professional: Professional;
}
