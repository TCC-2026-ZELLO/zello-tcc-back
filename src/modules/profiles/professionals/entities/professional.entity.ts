import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  DeleteDateColumn,
  OneToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../../users/entities/user.entity';
import { BusinessProfessional } from '../../../business-professionals/entities/business-professional.entity';
import { PortfolioImage } from './portfolio-image.entity';

@Entity('professional')
export class Professional {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt: Date;

  @OneToOne(() => User, (user) => user.professional)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => BusinessProfessional, (bp) => bp.professional)
  businessProfessionals: BusinessProfessional[];

  @Column({ type: 'varchar', length: 150, nullable: true })
  specialty: string;

  @Column({ type: 'text', nullable: true })
  biography: string;

  @Column({ name: 'photo_url', type: 'text', nullable: true })
  photoUrl: string;

  @Column({ name: 'banner_url', type: 'text', nullable: true })
  bannerUrl: string;

  @Column({ name: 'visibilityStatus', default: true })
  visibilityStatus: boolean;

  @Column({ name: 'profile_complete', default: false })
  profileComplete: boolean;
  @OneToMany(() => PortfolioImage, (pi) => pi.professional)
  portfolioImages: PortfolioImage[];
}
