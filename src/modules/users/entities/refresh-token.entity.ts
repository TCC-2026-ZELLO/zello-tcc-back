import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm'; // Importações obrigatórias do TypeORM
import { Usuario } from './user.entity'; // Importação da entidade Usuario para a FK

@Entity('refresh_token')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'hashed_token', type: 'varchar', unique: true })
  hashedToken: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  // Relacionamento N:1 — Vários tokens podem pertencer a um usuário
  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' }) // Define o nome da coluna no banco (FK)
  usuario: Usuario;
}
