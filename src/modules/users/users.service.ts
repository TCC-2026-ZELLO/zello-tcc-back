import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { AuthProvider, User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

function omitPasswordHash<T extends { passwordHash?: string }>(
  obj: T,
): Omit<T, 'passwordHash'> {
  const { passwordHash: _omit, ...rest } = obj;
  void _omit;
  return rest;
}
import { Role } from './entities/role.entity';
import { Professional } from '../profiles/professionals/entities/professional.entity';
import { Client } from '../profiles/clients/entities/client.entity';
import { Manager } from '../profiles/managers/entities/manager.entity';

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
    const roleName =
      createUserDto.accountType === 'PROFISSIONAL'
        ? 'professional'
        : createUserDto.accountType === 'ESTABELECIMENTO'
          ? 'manager'
          : 'client';

    const UserExistente = await this.findByEmailWithPassword(
      createUserDto.email,
    );

    if (UserExistente) {
      if (UserExistente.provider === AuthProvider.GOOGLE) {
        throw new ConflictException(
          'As credenciais fornecidas são inválidas ou o e-mail não está disponível para um cadastro de senha.',
        );
      }

      const isMatch = await bcrypt.compare(
        createUserDto.password,
        UserExistente.passwordHash,
      );

      if (!isMatch) {
        throw new ConflictException(
          'As credenciais fornecidas são inválidas ou o e-mail não está disponível para um cadastro de senha.',
        );
      }

      const hasRole = UserExistente.roles.some((r) => r.name === roleName);
      if (!hasRole) {
        return await this.UsersRepository.manager.transaction(
          async (transactionalEntityManager) => {
            const role = await this.RolesRepository.findOne({
              where: { name: roleName },
            });
            if (role) {
              UserExistente.roles.push(role);
              await transactionalEntityManager.save(User, UserExistente);

              if (roleName === 'professional') {
                const perf = transactionalEntityManager.create(Professional, {
                  user: UserExistente,
                });
                await transactionalEntityManager.save(Professional, perf);
              } else if (roleName === 'manager') {
                const perf = transactionalEntityManager.create(Manager, {
                  user: UserExistente,
                });
                await transactionalEntityManager.save(Manager, perf);
              } else if (roleName === 'client') {
                const perf = transactionalEntityManager.create(Client, {
                  user: UserExistente,
                });
                await transactionalEntityManager.save(Client, perf);
              }
            }
            return omitPasswordHash(UserExistente);
          },
        );
      }

      return omitPasswordHash(UserExistente);
    }

    const saltRounds = 10;
    const hash = await bcrypt.hash(createUserDto.password, saltRounds);

    return await this.UsersRepository.manager.transaction(
      async (transactionalEntityManager) => {
        const novoUser = transactionalEntityManager.create(User, {
          name: createUserDto.nome,
          email: createUserDto.email,
          passwordHash: hash,
        });

        const role = await transactionalEntityManager.findOne(Role, {
          where: { name: roleName },
        });
        if (role) {
          novoUser.roles = [role];
        }

        const UserSalvo = await transactionalEntityManager.save(User, novoUser);

        if (roleName === 'professional') {
          const perf = transactionalEntityManager.create(Professional, {
            user: UserSalvo,
          });
          await transactionalEntityManager.save(Professional, perf);
        } else if (roleName === 'client') {
          const perf = transactionalEntityManager.create(Client, {
            user: UserSalvo,
          });
          await transactionalEntityManager.save(Client, perf);
        } else if (roleName === 'manager') {
          const perf = transactionalEntityManager.create(Manager, {
            user: UserSalvo,
          });
          await transactionalEntityManager.save(Manager, perf);
        }

        return omitPasswordHash(UserSalvo);
      },
    );
  }

  async createViaGoogle(
    nome: string,
    email: string,
    googleId: string,
    accountType?: string,
  ) {
    const UserExistente = await this.UsersRepository.findOne({
      where: { email },
      relations: ['roles'],
    });

    const targetRoleName =
      accountType === 'PROFISSIONAL'
        ? 'professional'
        : accountType === 'ESTABELECIMENTO'
          ? 'manager'
          : 'client';

    if (UserExistente) {
      if (!UserExistente.googleId) {
        UserExistente.googleId = googleId;
        await this.UsersRepository.save(UserExistente);
      }

      const hasRole = UserExistente.roles.some(
        (r) => r.name === targetRoleName,
      );
      if (!hasRole && accountType) {
        return await this.UsersRepository.manager.transaction(
          async (transactionalEntityManager) => {
            const role = await this.RolesRepository.findOne({
              where: { name: targetRoleName },
            });
            if (role) {
              UserExistente.roles.push(role);
              await transactionalEntityManager.save(User, UserExistente);

              if (targetRoleName === 'professional') {
                const perf = transactionalEntityManager.create(Professional, {
                  user: UserExistente,
                });
                await transactionalEntityManager.save(Professional, perf);
              } else if (targetRoleName === 'manager') {
                const perf = transactionalEntityManager.create(Manager, {
                  user: UserExistente,
                });
                await transactionalEntityManager.save(Manager, perf);
              } else if (targetRoleName === 'client') {
                const perf = transactionalEntityManager.create(Client, {
                  user: UserExistente,
                });
                await transactionalEntityManager.save(Client, perf);
              }
            }
            return UserExistente;
          },
        );
      }

      return UserExistente;
    }

    const defaultRole = await this.RolesRepository.findOne({
      where: { name: targetRoleName },
    });

    return await this.UsersRepository.manager.transaction(
      async (transactionalEntityManager) => {
        const novoUserGoogle = transactionalEntityManager.create(User, {
          name: nome,
          email,
          googleId,
          provider: AuthProvider.GOOGLE,
          roles: defaultRole ? [defaultRole] : [],
        });

        const UserSalvo = await transactionalEntityManager.save(
          User,
          novoUserGoogle,
        );

        if (targetRoleName === 'professional') {
          const perf = transactionalEntityManager.create(Professional, {
            user: UserSalvo,
          });
          await transactionalEntityManager.save(Professional, perf);
        } else if (targetRoleName === 'manager') {
          const perf = transactionalEntityManager.create(Manager, {
            user: UserSalvo,
          });
          await transactionalEntityManager.save(Manager, perf);
        } else if (targetRoleName === 'client') {
          const perf = transactionalEntityManager.create(Client, {
            user: UserSalvo,
          });
          await transactionalEntityManager.save(Client, perf);
        }

        return UserSalvo;
      },
    );
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
      if (!updateUserDto.currentPassword) {
        throw new UnauthorizedException(
          'A senha atual é necessária para modificar a sua senha.',
        );
      }

      // passwordHash tem select:false na entity, então buscamos explicitamente
      const userWithHash = await this.UsersRepository.findOne({
        where: { id },
        select: ['id', 'passwordHash'],
      });

      if (!userWithHash?.passwordHash) {
        throw new UnauthorizedException(
          'Não é possível alterar a senha de uma conta vinculada ao Google.',
        );
      }

      const isMatch = await bcrypt.compare(
        updateUserDto.currentPassword,
        userWithHash.passwordHash,
      );
      if (!isMatch) {
        throw new UnauthorizedException(
          'A senha atual informada está incorreta.',
        );
      }
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
      User.passwordHash = updateUserDto.password;
    }

    if (updateUserDto.nome) User.name = updateUserDto.nome;
    if (updateUserDto.email && updateUserDto.email !== User.email) {
      const existing = await this.findByEmail(updateUserDto.email);
      if (existing) {
        throw new ConflictException('E-mail já cadastrado por outro usuário.');
      }
      User.email = updateUserDto.email;
    }

    const UserAtualizado = await this.UsersRepository.save(User);

    const userWithoutPasswordUpdated = omitPasswordHash(UserAtualizado);

    return {
      ...userWithoutPasswordUpdated,
      roles: userWithoutPasswordUpdated.roles?.map((p: Role) => p.name) || [],
    };
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

  async findByEmail(email: string): Promise<User | null> {
    return this.UsersRepository.findOne({
      where: { email },
      relations: ['roles'],
    });
  }

  async updatePassword(
    id: string,
    newPassword: string,
    manager?: EntityManager,
  ) {
    const saltRounds = 10;
    const hash = await bcrypt.hash(newPassword, saltRounds);

    if (manager) {
      await manager.update(User, id, { passwordHash: hash });
    } else {
      await this.UsersRepository.update(id, { passwordHash: hash });
    }
  }
}
