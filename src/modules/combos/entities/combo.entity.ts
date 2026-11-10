import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { Business } from '../../businesses/entities/business.entity';
import { ComboItem } from './combo-item.entity';
import { NumericTransformer } from '../../../common/numeric.transformer';

@Entity('combos')
export class Combo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    transformer: NumericTransformer,
  })
  price: number;

  @Column({ default: true })
  active: boolean;

  @Index()
  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  business: Business;

  @OneToMany(() => ComboItem, (item) => item.combo, {
    cascade: ['insert', 'update'],
  })
  items: ComboItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
