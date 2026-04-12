// src/modules/users/entities/user.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  JoinTable,
  CreateDateColumn,
  DeleteDateColumn,
  OneToOne,
  OneToMany,
} from 'typeorm';
import { RefreshToken } from './refresh-token.entity';
import { Papel } from './role.entity';
import { Cliente } from './client.entity';
import { Profissional } from './professional.entity';
import { Gestor } from './manager.entity';

@Entity('usuario')
export class Usuario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nome: string;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'google_id', unique: true, nullable: true })
  googleId: string;

  @Column({ name: 'password_hash', nullable: true, select: false })
  passwordHash: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date;

  @ManyToMany(() => Papel, (papel) => papel.usuarios)
  @JoinTable({
    name: 'usuario_papel',
    joinColumn: { name: 'usuario_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'papel_id', referencedColumnName: 'id' },
  })
  papeis: Papel[];

  // Relações de especialização (1:1)
  @OneToOne(() => Cliente, (cliente) => cliente.usuario)
  cliente: Cliente;

  @OneToOne(() => Profissional, (profissional) => profissional.usuario)
  profissional: Profissional;

  @OneToOne(() => Gestor, (gestor) => gestor.usuario)
  gestor: Gestor;

  // Relação 1:N — Um usuário pode ter vários refresh tokens
  @OneToMany(() => RefreshToken, (token) => token.usuario)
  refreshTokens: RefreshToken[];
}
