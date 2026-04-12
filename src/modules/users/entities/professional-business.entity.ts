import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Profissional } from './professional.entity';
import { Empresa } from './business.entity';

@Entity('profissional_empresa')
export class ProfissionalEmpresa {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'boolean', default: true })
  ativo: boolean;

  @ManyToOne(() => Profissional)
  @JoinColumn({ name: 'profissional_id' })
  profissional: Profissional;

  @ManyToOne(() => Empresa)
  @JoinColumn({ name: 'empresa_id' })
  empresa: Empresa;
}
