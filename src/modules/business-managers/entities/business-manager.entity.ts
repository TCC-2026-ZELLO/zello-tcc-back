import { Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Manager } from '../../profiles/managers/entities/manager.entity';
import { Business } from '../../businesses/entities/business.entity';

@Entity('manager_business')
export class BusinessManager {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Manager, (manager) => manager.businessManagers)
  @JoinColumn({ name: 'manager_id' })
  manager: Manager;

  @ManyToOne(() => Business, (business) => business.businessManagers)
  @JoinColumn({ name: 'business_id' })
  business: Business;
}
