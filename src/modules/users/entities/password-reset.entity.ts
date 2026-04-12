import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Usuario } from './user.entity';

@Entity('password_reset')
export class PasswordReset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'hashed_token', type: 'varchar', unique: true })
  hashedToken: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  // Relacionamento com Usuario para saber de quem é o pedido de recuperação
  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;
}
