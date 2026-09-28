import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SearchQueryDto, SortBy } from './dto/search-query.dto';
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

  // ─── Profissionais ─────────────────────────────────────────────────────────

  async searchProfessionals(query: SearchQueryDto) {
    const qb = this.proRepo
      .createQueryBuilder('professional')
      .leftJoinAndSelect('professional.user', 'user')
      .leftJoin('professional.businessProfessionals', 'bp')
      .leftJoin('bp.services', 'bps')
      .leftJoin('bps.service', 'service')
      .where('professional.visibilityStatus = :visible', { visible: true })
      .addSelect('MIN(service.price)', 'minPrice')
      .groupBy('professional.id')
      .addGroupBy('user.id');

    // ── Busca textual ──────────────────────────────────────────────────────
    if (query.q) {
      qb.andWhere(
        '(user.name ILIKE :search OR professional.specialty ILIKE :search OR professional.biography ILIKE :search)',
        { search: `%${query.q}%` },
      );
    }

    // ── Filtro: avaliação mínima ───────────────────────────────────────────
    if (query.minRating !== undefined) {
      qb.andWhere('professional.average_rating >= :minRating', {
        minRating: query.minRating,
      });
    }

    // ── Filtro: faixa de preço (HAVING porque é agregado) ─────────────────
    if (query.minPrice !== undefined && query.maxPrice !== undefined) {
      qb.having('MIN(service.price) BETWEEN :minPrice AND :maxPrice', {
        minPrice: query.minPrice,
        maxPrice: query.maxPrice,
      });
    } else if (query.minPrice !== undefined) {
      qb.having('MIN(service.price) >= :minPrice', { minPrice: query.minPrice });
    } else if (query.maxPrice !== undefined) {
      qb.having('MIN(service.price) <= :maxPrice OR MIN(service.price) IS NULL', {
        maxPrice: query.maxPrice,
      });
    }

    // ── Ordenação (CA1, CA2, CA4) ─────────────────────────────────────────
    switch (query.sortBy) {
      case SortBy.TRENDING:
        qb.orderBy('professional.average_rating', 'DESC').addOrderBy('user.name', 'ASC');
        break;
      case SortBy.PRICE_ASC:
        qb.orderBy('MIN(service.price)', 'ASC').addOrderBy('professional.average_rating', 'DESC');
        break;
      default:
        // CA5 — relevância padrão: rating desc → nome asc
        qb.orderBy('professional.average_rating', 'DESC').addOrderBy('user.name', 'ASC');
    }

    const limit = Math.min(query.limit ?? 20, 100);
    const { raw, entities } = await qb.limit(limit).getRawAndEntities();

    return entities.map((pro, i) => ({
      id: pro.id,
      user: { name: pro.user?.name || 'Profissional' },
      specialty: pro.specialty || 'Especialista',
      photoUrl: pro.photoUrl,
      bannerUrl: pro.bannerUrl,
      rating: pro.averageRating ?? 5.0,
      minPrice: raw[i]?.minPrice != null ? Number(Number(raw[i].minPrice).toFixed(2)) : null,
      city: 'Curitiba',
    }));
  }

  /** CA3 — Top profissionais para a seção "Recomendados" na home */
  async getRecommended(limit = 4) {
    return this.searchProfessionals({ sortBy: SortBy.TRENDING, limit });
  }

  // ─── Estabelecimentos ──────────────────────────────────────────────────────

  async searchBusinesses(query: SearchQueryDto) {
    const qb = this.businessRepo
      .createQueryBuilder('business')
      .where('business.defaulting = :status', { status: false });

    if (query.q) {
      qb.andWhere('business.tradeName ILIKE :search', {
        search: `%${query.q}%`,
      });
    }

    const businesses = await qb.take(query.limit ?? 20).getMany();

    return businesses.map((emp) => ({
      id: emp.id,
      name: emp.tradeName,
      specialty: 'Estabelecimento',
      rating: 4.8,
      photoUrl: emp.photoUrl,
      bannerUrl: emp.bannerUrl,
    }));
  }
}
