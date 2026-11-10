import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Professional } from './professional.entity';

@Entity('portfolio_image')
export class PortfolioImage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  url: string;

  @ManyToOne(() => Professional, (pro) => pro.portfolioImages, {
    onDelete: 'CASCADE',
  })
  professional: Professional;
}
