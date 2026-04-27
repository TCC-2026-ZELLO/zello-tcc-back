import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Business } from './business.entity';

@Entity('portfolio_image')
export class GalleryImage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  url: string;

  @ManyToOne(() => Business, (pro) => pro.galleryImages, {
    onDelete: 'CASCADE',
  })
  business: Business;
}
