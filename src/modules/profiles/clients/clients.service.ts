import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from './entities/client.entity';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
  ) {}

  create() {
    throw new BadRequestException(
      'A criação de perfis de cliente deve ser feita através da criação de um Usuário com a role "client".',
    );
  }

  async findAll() {
    return await this.clientRepo.find({
      relations: ['user'],
    });
  }

  async findOne(id: string) {
    const client = await this.clientRepo.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!client) {
      throw new NotFoundException(
        `Perfil de cliente com ID "${id}" não encontrado.`,
      );
    }

    return client;
  }

  async update(id: string, updateClientDto: UpdateClientDto) {
    const client = await this.findOne(id);
    this.clientRepo.merge(client, updateClientDto);

    return await this.clientRepo.save(client);
  }

  async remove(id: string) {
    const client = await this.findOne(id);
    await this.clientRepo.remove(client);
    return { message: 'Perfil de cliente removido com sucesso.' };
  }
}
