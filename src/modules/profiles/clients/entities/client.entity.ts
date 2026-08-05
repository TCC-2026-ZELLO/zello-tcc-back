import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../../users/entities/user.entity';

@Entity('client')
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'no_show_count', type: 'int', default: 0 })
  noShowCount: number;

  @Column({ name: 'success_streak', type: 'int', default: 0 })
  successStreak: number;

  @Column({ name: 'photo_url', type: 'text', nullable: true })
  photoUrl: string;

  @OneToOne(() => User, (user) => user.client)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
