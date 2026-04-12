import { Entity, PrimaryGeneratedColumn, OneToOne, JoinColumn } from 'typeorm';
import { Usuario } from './user.entity';

@Entity('gestor')
export class Gestor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Usuario)
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;
}
