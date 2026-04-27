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
        '(user.name ILIKE :search OR professional.specialty ILIKE :search OR professional.biography ILIKE :search)',
        {
          search: `%${query.q}%`,
        },
      );
    }

    if (query.filter === SearchFilter.RATING) {
      qb.orderBy('user.name', 'ASC');
    }

    const professionals = await qb.take(20).getMany();

    return professionals.map((pro) => ({
      id: pro.id,
      user: {
        name: pro.user?.name || 'Profissional',
      },
      specialty: pro.specialty || 'Especialista',
      photoUrl: pro.photoUrl,
      bannerUrl: pro.bannerUrl,
      rating: 5.0,
      price: pro.specialty ? '$$' : '---',
      city: 'Curitiba',
    }));
  }

  async searchBusinesses(query: SearchQueryDto) {
    const qb = this.businessRepo
      .createQueryBuilder('business')
      .where('business.defaulting = :status', { status: false });

    if (query.q) {
      qb.andWhere('business.tradeName ILIKE :search', {
        search: `%${query.q}%`,
      });
    }

    const businesses = await qb.take(20).getMany();

    return businesses.map((emp) => ({
      id: emp.id,
      name: emp.tradeName,
      specialty: 'Estabelecimento',
      rating: 4.8,
    }));
  }
}
