import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Business } from '../../businesses/entities/business.entity';
import { User } from '../../users/entities/user.entity';

@Entity('business_view')
@Unique('UQ_business_view_daily', ['business', 'viewer', 'viewDate'])
@Index('IDX_business_view_business_date', ['business', 'viewDate'])
export class BusinessView {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_business_view_business')
  @ManyToOne(() => Business, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'viewer_id' })
  viewer: User;

  @Column({ name: 'view_date', type: 'date' })
  viewDate: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
