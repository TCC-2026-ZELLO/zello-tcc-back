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
  Index,
} from 'typeorm';
import { RefreshToken } from './refresh-token.entity';
import { Role } from './role.entity';
import { Manager } from '../../profiles/managers/entities/manager.entity';
import { Professional } from '../../profiles/professionals/entities/professional.entity';
import { Client } from '../../profiles/clients/entities/client.entity';
import { Address } from '../../addresses/entities/address.entity';

export enum AuthProvider {
  LOCAL = 'local',
  GOOGLE = 'google',
}

@Entity('user')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

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

  @Column({
    type: 'enum',
    enum: AuthProvider,
    default: AuthProvider.LOCAL,
  })
  @Index()
  provider: AuthProvider;

  @Column({ name: 'phone', type: 'varchar', length: 15, nullable: true })
  phone: string;

  @Column({ name: 'cpf', type: 'varchar', length: 11, nullable: true, unique: true })
  cpf: string;

  @Column({ name: 'phone_verified_at', type: 'timestamptz', nullable: true })
  phoneVerifiedAt: Date;

  @ManyToMany(() => Role, (role) => role.users)
  @JoinTable({
    name: 'user_role',
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'role_id', referencedColumnName: 'id' },
  })
  roles: Role[];

  @OneToOne(() => Client, (client) => client.user)
  client: Client;

  @OneToOne(() => Professional, (professional) => professional.user)
  professional: Professional;

  @OneToOne(() => Manager, (manager) => manager.user)
  manager: Manager;

  @OneToOne(() => Address, (address) => address.user)
  address: Address;

  @OneToMany(() => RefreshToken, (token) => token.user)
  refreshTokens: RefreshToken[];
}
