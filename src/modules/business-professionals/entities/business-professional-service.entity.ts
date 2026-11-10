import { Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { BusinessProfessional } from './business-professional.entity';
import { Service } from '../../catalog/entities/service.entity';

@Entity('business_professional_services')
export class BusinessProfessionalService {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => BusinessProfessional, (bp) => bp.services, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'business_professional_id' })
  businessProfessional: BusinessProfessional;

  @ManyToOne(() => Service, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'service_id' })
  service: Service;
}
