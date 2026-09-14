import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Unique,
} from 'typeorm';
import { Combo } from './combo.entity';
import { Service } from '../../catalog/entities/service.entity';

@Entity('combo_items')
@Unique('UQ_combo_item', ['combo', 'service', 'sequence'])
export class ComboItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Combo, (combo) => combo.items, { onDelete: 'CASCADE' })
  combo: Combo;

  @ManyToOne(() => Service, { eager: true, onDelete: 'CASCADE' })
  service: Service;

  @Column({ type: 'int', default: 0 })
  sequence: number;
}
