import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthProvider, User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';
import { Role } from './entities/role.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private UsersRepository: Repository<User>,

    @InjectRepository(Role)
    private RolesRepository: Repository<Role>,
  ) {}

  async onModuleInit() {
    await this.seedRoles();
  }

  private async seedRoles() {
    const defaultRoles = ['admin', 'professional', 'client', 'manager'];

    for (const roleName of defaultRoles) {
      const exists = await this.RolesRepository.findOne({
        where: { name: roleName },
      });

      if (!exists) {
        const newRole = this.RolesRepository.create({ name: roleName });
        await this.RolesRepository.save(newRole);
        console.log(`[Seed]: Role '${roleName}' criada com sucesso.`);
      }
    }
  }

  async create(createUserDto: CreateUserDto) {
    const saltRounds = 10;
    const hash = await bcrypt.hash(createUserDto.password, saltRounds);

    const novoUser = this.UsersRepository.create({
      name: createUserDto.nome,
      email: createUserDto.email,
      passwordHash: hash,
    });

    const UserSalvo = await this.UsersRepository.save(novoUser);

    const { passwordHash, ...userWithoutPassword } = UserSalvo;
    return userWithoutPassword;
  }

  async createViaGoogle(nome: string, email: string, googleId: string) {
    const UserExistente = await this.UsersRepository.findOne({
      where: { email },
      relations: ['roles'],
    });

    if (UserExistente) {
      if (!UserExistente.googleId) {
        UserExistente.googleId = googleId;
        await this.UsersRepository.save(UserExistente);
      }
      return UserExistente;
    }

    const defaultRole = await this.RolesRepository.findOne({
      where: { name: 'User' },
    });

    const novoUserGoogle = this.UsersRepository.create({
      name: nome,
      email,
      googleId,
      provider: AuthProvider.GOOGLE,
      roles: defaultRole ? [defaultRole] : [],
    });

    return await this.UsersRepository.save(novoUserGoogle);
  }

  async updateGoogleId(id: string, googleId: string) {
    return await this.UsersRepository.update(id, { googleId });
  }

  async findOne(id: string) {
    const User = await this.UsersRepository.findOne({
      where: { id },
      relations: ['roles'],
    });

    if (!User) {
      throw new NotFoundException(
        'Usuário não encontrado em nossa base de dados.',
      );
    }

    return User;
  }

  async findAll() {
    return await this.UsersRepository.find({
      relations: ['roles'],
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const User = await this.findOne(id);

    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
      User.passwordHash = updateUserDto.password;
    }

    if (updateUserDto.nome) User.name = updateUserDto.nome;
    if (updateUserDto.email) User.email = updateUserDto.email;

    const UserAtualizado = await this.UsersRepository.save(User);

    const { passwordHash, ...userWithoutPasswordUpdated } = UserAtualizado;

    return userWithoutPasswordUpdated;
  }

  async remove(id: string) {
    await this.findOne(id);

    await this.UsersRepository.softDelete(id);

    return { message: 'Usuário excluído com sucesso.' };
  }

  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.UsersRepository.findOne({
      where: { email },
      relations: ['roles'],
      select: ['id', 'name', 'email', 'passwordHash', 'provider', 'roles'],
    });
  }
}
