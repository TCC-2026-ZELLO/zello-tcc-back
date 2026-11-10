import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Manager } from './entities/manager.entity';

@Injectable()
export class ManagersService {
  constructor(
    @InjectRepository(Manager)
    private readonly managerRepo: Repository<Manager>,
  ) {}

  create() {
    throw new BadRequestException(
      'A criação de gerentes deve ser feita através da criação de um Usuário com a role "manager".',
    );
  }

  async findAll() {
    return await this.managerRepo.find({
      relations: ['user', 'businessManagers', 'businessManagers.business'],
    });
  }

  async findOne(id: string) {
    const manager = await this.managerRepo.findOne({
      where: { id },
      relations: ['user', 'businessManagers', 'businessManagers.business'],
    });

    if (!manager) {
      throw new NotFoundException(
        `Perfil de gerente com ID "${id}" não encontrado.`,
      );
    }

    return manager;
  }

  update(id: string) {
    throw new BadRequestException(
      'A entidade Manager não possui campos diretos para atualização.',
    );
  }

  async remove(id: string) {
    const manager = await this.findOne(id);
    await this.managerRepo.remove(manager);
    return { message: 'Perfil de gerente removido com sucesso.' };
  }
}
