import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  DeleteDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../../users/entities/user.entity';

@Entity('professional')
export class Professional {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', nullable: true })
  biography: string;

  @Column({ name: 'visibilityStatus', default: true })
  visibilityStatus: boolean;

  @Column({ name: 'profile_complete', default: false })
  profileComplete: boolean;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt: Date;

  @OneToOne(() => User, (user) => user.professional)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
