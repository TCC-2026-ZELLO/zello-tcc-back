import {
  Entity,
  PrimaryGeneratedColumn,
  OneToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../../users/entities/user.entity';
import { BusinessManager } from '../../../business-managers/entities/business-manager.entity';

@Entity('manager')
export class Manager {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, (user) => user.manager)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => BusinessManager, (bm) => bm.manager)
  businessManagers: BusinessManager[];
}
