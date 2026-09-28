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
    const saved = await manager.save(address);
    await this.syncLocation(saved.id, data.latitude, data.longitude, manager);
    return saved;
  }

  async createForUser(userId: string, data: Partial<Address>, em?: EntityManager): Promise<Address> {
    const manager = em || this.addressesRepository.manager;
    const address = manager.create(Address, {
      ...data,
      user: { id: userId },
    });
    const saved = await manager.save(address);
    await this.syncLocation(saved.id, data.latitude, data.longitude, manager);
    return saved;
  }

  private async syncLocation(
    addressId: string,
    latitude: number | null | undefined,
    longitude: number | null | undefined,
    manager: EntityManager,
  ): Promise<void> {
    if (latitude === undefined || longitude === undefined || latitude === null || longitude === null) {
      return;
    }

    await manager.query(
      `UPDATE address
       SET location = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
       WHERE id = $3`,
      [longitude, latitude, addressId],
    );
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
    await this.syncLocation(id, data.latitude, data.longitude, this.addressesRepository.manager);
    return this.addressesRepository.findOne({ where: { id } });
  }
}
