import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  DeleteDateColumn,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { BusinessProfessional } from '../../business-professionals/entities/business-professional.entity';
import { BusinessManager } from '../../business-managers/entities/business-manager.entity';
import { GalleryImage } from './gallery-image.entity';
import { Address } from '../../addresses/entities/address.entity';

@Entity('business')
export class Business {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'trade_name' })
  tradeName: string;

  @Column({ default: false })
  defaulting: boolean;

  @Column({ name: 'visibilityStatus', default: true })
  visibilityStatus: boolean;

  @Column({ name: 'cnpj', type: 'varchar', length: 14, nullable: true, unique: true })
  cnpj: string;

  @Column({ name: 'legal_name', type: 'varchar', length: 200, nullable: true })
  legalName: string;

  @Column({ name: 'phone', type: 'varchar', length: 15, nullable: true })
  phone: string;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt: Date;

  @OneToMany(() => BusinessProfessional, (bp) => bp.business)
  businessProfessionals: BusinessProfessional[];

  @OneToMany(() => BusinessManager, (bm) => bm.business)
  businessManagers: BusinessManager[];

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'photo_url', type: 'text', nullable: true })
  photoUrl: string;

  @Column({ name: 'banner_url', type: 'text', nullable: true })
  bannerUrl: string;

  @OneToMany(() => GalleryImage, (pi) => pi.business)
  galleryImages: GalleryImage[];

  @OneToOne(() => Address, (address) => address.business)
  address: Address;

  @Column({ name: 'profile_complete', default: false })
  profileComplete: boolean;

  @Column({ name: 'timezone', default: 'America/Sao_Paulo' })
  timezone: string;
}
