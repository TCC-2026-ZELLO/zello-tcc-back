import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Professional } from '../../profiles/professionals/entities/professional.entity';
import { Business } from '../../businesses/entities/business.entity';
import { BusinessProfessionalService } from './business-professional-service.entity';

@Entity('professional_business')
export class BusinessProfessional {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @ManyToOne(
    () => Professional,
    (professional) => professional.businessProfessionals,
  )
  @JoinColumn({ name: 'professional_id' })
  professional: Professional;

  @ManyToOne(() => Business, (business) => business.businessProfessionals)
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @OneToMany(
    () => BusinessProfessionalService,
    (bps) => bps.businessProfessional,
  )
  services: BusinessProfessionalService[];
}
