import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Business } from '../../businesses/entities/business.entity';

/** Converte a string retornada pelo driver `pg` para colunas decimal/numeric em number. */
const decimalTransformer = {
  to: (value?: number | null): number | null | undefined => value,
  from: (value: string | null): number | null =>
    value === null || value === undefined ? null : parseFloat(value),
};

@Entity('address')
export class Address {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Business, (b) => b.address, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @OneToOne(() => User, (u) => u.address, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'zip_code', type: 'varchar', length: 8 })
  zipCode: string;

  @Column({ type: 'varchar', length: 200 })
  street: string;

  @Column({ type: 'varchar', length: 20 })
  number: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  complement: string;

  @Column({ type: 'varchar', length: 100 })
  neighborhood: string;

  @Column({ type: 'varchar', length: 100 })
  city: string;

  @Column({ type: 'varchar', length: 2 })
  state: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({
    name: 'latitude',
    type: 'decimal',
    precision: 10,
    scale: 7,
    nullable: true,
    transformer: decimalTransformer,
  })
  latitude: number | null;

  @Column({
    name: 'longitude',
    type: 'decimal',
    precision: 10,
    scale: 7,
    nullable: true,
    transformer: decimalTransformer,
  })
  longitude: number | null;


  @Index('IDX_address_location_gist', { spatial: true })
  @Column({
    name: 'location',
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  location: string | null;
}
