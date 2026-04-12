import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Usuario } from './user.entity';

@Entity('cliente')
export class Cliente {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'no_show_count', type: 'int', default: 0 })
  noShowCount: number;

  @Column({ name: 'streak_sucesso', type: 'int', default: 0 })
  streakSucesso: number;

  @OneToOne(() => Usuario, (usuario) => usuario.cliente)
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;
}
