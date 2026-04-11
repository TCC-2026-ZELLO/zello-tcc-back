import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  JoinTable,
  CreateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { Papel } from './papeis.entity';

@Entity('usuarios')
export class Usuario {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  nome: string;

  @Column({ type: 'varchar', unique: true })
  email: string;

  @Column({ type: 'varchar', unique: true, nullable: true, default: null })
  google_id: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  senha_hash: string | null;

  @Column({ type: 'boolean', default: false })
  termos_aceitos: boolean;

  @Column({ type: 'int', default: 0 })
  no_show_count: number;

  // int — streak de comparecimentos (do diagrama)
  @Column({ type: 'int', default: 0 })
  streak_sucesso: number;

  // timestamptz — criado automaticamente pelo TypeORM
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  // timestamptz nullable — soft-delete (do diagrama)
  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  // Relação N:N com PAPEIS — TypeORM gera a tabela USUARIO_PAPEIS automaticamente
  @ManyToMany(() => Papel, (papel) => papel.usuarios, { eager: true })
  @JoinTable({
    name: 'usuario_papeis',          // nome exato da tabela no seu diagrama
    joinColumn: {
      name: 'usuario_id',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: 'papel_id',
      referencedColumnName: 'id',
    },
  })
  papeis: Papel[];
}