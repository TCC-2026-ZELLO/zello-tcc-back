// src/modules/users/entities/user.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  DeleteDateColumn,
} from 'typeorm';

// Entidade Empresa
@Entity('empresa')
export class Empresa {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'nome_fantasia' })
  nomeFantasia: string;

  @Column({ default: false })
  inadimplente: boolean;
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt: Date;
}
