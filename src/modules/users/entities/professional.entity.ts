import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  DeleteDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Usuario } from './user.entity';

@Entity('profissional')
export class Profissional {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', nullable: true })
  biografia: string;

  @Column({ name: 'status_visibilidade', default: true })
  statusVisibilidade: boolean;

  @Column({ name: 'perfil_completo', default: false })
  perfilCompleto: boolean;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt: Date;

  @OneToOne(() => Usuario, (usuario) => usuario.profissional)
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;
}
