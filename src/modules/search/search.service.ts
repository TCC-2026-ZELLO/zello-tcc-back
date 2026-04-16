import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SearchQueryDto, SearchFilter } from './dto/search-query.dto';
import { Professional } from '../profiles/professionals/entities/professional.entity';
import { Business } from '../businesses/entities/business.entity';

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Professional)
    private proRepo: Repository<Professional>,
    @InjectRepository(Business)
    private businessRepo: Repository<Business>,
  ) {}

  async searchProfessionals(query: SearchQueryDto) {
    const qb = this.proRepo
      .createQueryBuilder('professional')
      .leftJoinAndSelect('professional.user', 'user')
      .where('professional.visibilityStatus = :visible', { visible: true });

    if (query.q) {
      qb.andWhere(
        '(user.name ILIKE :search OR professional.biography ILIKE :search)',
        {
          search: `%${query.q}%`,
        },
      );
    }

    if (query.filter === SearchFilter.RATING) {
      // Placeholder
    }

    const professionals = await qb.take(20).getMany();
    // Placeholder mock
    return professionals.map((pro) => ({
      id: pro.id,
      name: pro.user?.name || 'Professional',
      specialty: 'Specialist',
      rating: 4.9,
      distance: 'A calcular...',
      price: '$$',
      bio: pro.user,
    }));
  }

  async searchBusinesses(query: SearchQueryDto) {
    const qb = this.businessRepo
      .createQueryBuilder('Business')
      .where('Business.defaulting = :status', { status: false });

    if (query.q) {
      qb.andWhere('Business.tradeName ILIKE :search', {
        search: `%${query.q}%`,
      });
    }

    const Businesss = await qb.take(20).getMany();

    return Businesss.map((emp) => ({
      id: emp.id,
      name: emp.tradeName,
      specialty: 'Salão Completo',
      rating: 4.8,
      distance: 'A calcular...',
      price: '$$$',
    }));
  }
}
