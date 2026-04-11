import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
} from 'typeorm';
import { Usuario } from './user.entity';
 
@Entity('papeis')
export class Papel {
  @PrimaryGeneratedColumn('uuid')
  id: string;
 
  @Column({ type: 'varchar', unique: true })
  nome: string;
 
  @ManyToMany(() => Usuario, (usuario) => usuario.papeis)
  usuarios: Usuario[];
}
 