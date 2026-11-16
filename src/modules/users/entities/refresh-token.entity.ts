import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

/**
 * Sessão do usuário mantida no backend (v5.0.0-7.2.1).
 *
 * - `id` é o identificador estável da sessão (claim `sid` do token de acesso).
 * - `tokenId` é o identificador do refresh token vigente, trocado a cada uso
 *   (rotação, v5.0.0-7.2.4).
 * - `lastUsedAt` e `sessionStartedAt` sustentam os limites de inatividade e de
 *   vida máxima (v5.0.0-7.3.1 e 7.3.2).
 * Apagar a linha encerra a sessão imediatamente (v5.0.0-7.4.1).
 */
@Entity('refresh_token')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'token_id', type: 'uuid', unique: true })
  @Index()
  tokenId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({
    name: 'session_started_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  sessionStartedAt: Date;

  @Column({
    name: 'last_used_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  lastUsedAt: Date;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
