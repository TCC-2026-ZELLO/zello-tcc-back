import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Address } from './entities/address.entity';

@Injectable()
export class AddressesService {
  constructor(
    @InjectRepository(Address)
    private readonly addressesRepository: Repository<Address>,
  ) {}

  async createForBusiness(businessId: string, data: Partial<Address>, em?: EntityManager): Promise<Address> {
    const manager = em || this.addressesRepository.manager;
    const address = manager.create(Address, {
      ...data,
      business: { id: businessId },
    });
    return manager.save(address);
  }

  async createForUser(userId: string, data: Partial<Address>, em?: EntityManager): Promise<Address> {
    const manager = em || this.addressesRepository.manager;
    const address = manager.create(Address, {
      ...data,
      user: { id: userId },
    });
    return manager.save(address);
  }

  async findByBusinessId(businessId: string): Promise<Address | null> {
    return this.addressesRepository.findOne({
      where: { business: { id: businessId } },
    });
  }

  async findByUserId(userId: string): Promise<Address | null> {
    return this.addressesRepository.findOne({
      where: { user: { id: userId } },
    });
  }

  async update(id: string, data: Partial<Address>): Promise<Address | null> {
    await this.addressesRepository.update(id, data);
    return this.addressesRepository.findOne({ where: { id } });
  }
}
