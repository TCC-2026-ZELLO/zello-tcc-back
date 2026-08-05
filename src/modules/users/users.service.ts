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
import { Business } from '../businesses/entities/business.entity';
import { BusinessManager } from '../business-managers/entities/business-manager.entity';
import { Address } from '../addresses/entities/address.entity';
import { FilesService } from '../files/files.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,

    @InjectRepository(Role)
    private readonly rolesRepository: Repository<Role>,

    private readonly filesService: FilesService,
  ) {}

  async onModuleInit() {
    await this.seedRoles();
  }

  private async seedRoles() {
    const defaultRoles = ['admin', 'professional', 'client', 'manager'];

    for (const roleName of defaultRoles) {
      const exists = await this.rolesRepository.findOne({
        where: { name: roleName },
      });

      if (!exists) {
        const newRole = this.rolesRepository.create({ name: roleName });
        await this.rolesRepository.save(newRole);
        console.log(`[Seed]: Role '${roleName}' criada com sucesso.`);
      }
    }
  }

  async create(createUserDto: CreateUserDto, photo?: Express.Multer.File) {
    const roleName =
      createUserDto.accountType === 'PROFISSIONAL'
        ? 'professional'
        : createUserDto.accountType === 'ESTABELECIMENTO'
          ? 'manager'
          : 'client';

    let photoUrl: string | null = null;
    if (photo) {
      const folder = createUserDto.accountType === 'ESTABELECIMENTO' ? 'business-photos' 
        : createUserDto.accountType === 'PROFISSIONAL' ? 'avatars' 
        : 'client-photos';
      photoUrl = await this.filesService.uploadPublicFile(photo as any, folder);
    }

    const userExistente = await this.findByEmailWithPassword(
      createUserDto.email,
    );

    if (userExistente) {
      if (userExistente.provider === AuthProvider.GOOGLE) {
        throw new ConflictException(
          'As credenciais fornecidas são inválidas ou o e-mail não está disponível para um cadastro de senha.',
        );
      }

      const isMatch = await bcrypt.compare(
        createUserDto.password,
        userExistente.passwordHash,
      );

      if (!isMatch) {
        throw new ConflictException(
          'As credenciais fornecidas são inválidas ou o e-mail não está disponível para um cadastro de senha.',
        );
      }

      return await this.usersRepository.manager.transaction(
        async (em: EntityManager) => {
          if (roleName === 'professional')
            await this.appendProfessional(userExistente.id, em, {
              specialty: createUserDto.specialty,
              biography: createUserDto.biography,
              photoUrl,
            });
          else if (roleName === 'manager')
            await this.appendManager(userExistente.id, em, {
              legalName: createUserDto.legalName,
              cnpj: createUserDto.cnpj,
              tradeName: createUserDto.tradeName,
              phone: createUserDto.businessPhone,
              photoUrl,
              address: createUserDto.zipCode ? {
                zipCode: createUserDto.zipCode!,
                street: createUserDto.street!,
                number: createUserDto.addressNumber!,
                complement: createUserDto.complement,
                neighborhood: createUserDto.neighborhood!,
                city: createUserDto.city!,
                state: createUserDto.state!,
              } : undefined,
            });
          else if (roleName === 'client')
            await this.appendClient(userExistente.id, em, photoUrl);

          const updatedUser = await this.findOne(userExistente.id, em);
          return omitPasswordHash(updatedUser);
        },
      );
    }

    const saltRounds = 10;
    const hash = await bcrypt.hash(createUserDto.password, saltRounds);

    return await this.usersRepository.manager.transaction(
      async (em: EntityManager) => {
        const novoUser = em.create(User, {
          name: createUserDto.nome,
          email: createUserDto.email,
          passwordHash: hash,
          phone: createUserDto.phone,
          cpf: createUserDto.cpf || undefined,
        });

        const userSalvo = await em.save(User, novoUser);

        if (roleName === 'professional')
          await this.appendProfessional(userSalvo.id, em, {
            specialty: createUserDto.specialty,
            biography: createUserDto.biography,
            photoUrl,
          });
        else if (roleName === 'client') {
          await this.appendClient(userSalvo.id, em, photoUrl);
          // Create address for client if provided
          if (createUserDto.clientZipCode) {
            const address = em.create(Address, {
              zipCode: createUserDto.clientZipCode,
              street: createUserDto.clientStreet!,
              number: createUserDto.clientNumber!,
              complement: createUserDto.clientComplement || undefined,
              neighborhood: createUserDto.clientNeighborhood!,
              city: createUserDto.clientCity,
              state: createUserDto.clientState,
              user: userSalvo,
            });
            await em.save(Address, address);
          }
        }
        else if (roleName === 'manager')
          await this.appendManager(userSalvo.id, em, {
            legalName: createUserDto.legalName,
            cnpj: createUserDto.cnpj,
            tradeName: createUserDto.tradeName,
            phone: createUserDto.businessPhone,
            photoUrl,
            address: createUserDto.zipCode ? {
              zipCode: createUserDto.zipCode!,
              street: createUserDto.street!,
              number: createUserDto.addressNumber!,
              complement: createUserDto.complement,
              neighborhood: createUserDto.neighborhood!,
              city: createUserDto.city!,
              state: createUserDto.state!,
            } : undefined,
          });

        const savedUser = await this.findOne(userSalvo.id, em);
        return omitPasswordHash(savedUser);
      },
    );
  }

  async createViaGoogle(
    nome: string,
    email: string,
    googleId: string,
    accountType?: string,
  ) {
    const userExistente = await this.usersRepository.findOne({
      where: { email },
      relations: ['roles'],
    });

    const targetRoleName =
      accountType === 'PROFISSIONAL'
        ? 'professional'
        : accountType === 'ESTABELECIMENTO'
          ? 'manager'
          : 'client';

    if (userExistente) {
      if (!userExistente.googleId) {
        userExistente.googleId = googleId;
        await this.usersRepository.save(userExistente);
      }

      if (accountType) {
        await this.usersRepository.manager.transaction(
          async (em: EntityManager) => {
            if (targetRoleName === 'professional')
              await this.appendProfessional(userExistente.id, em);
            else if (targetRoleName === 'manager')
              await this.appendManager(userExistente.id, em);
            else if (targetRoleName === 'client')
              await this.appendClient(userExistente.id, em);
          },
        );
      }

      return await this.findOne(userExistente.id);
    }

    const defaultRole = await this.rolesRepository.findOne({
      where: { name: targetRoleName },
    });

    return await this.usersRepository.manager.transaction(
      async (em: EntityManager) => {
        const novoUserGoogle = em.create(User, {
          name: nome,
          email,
          googleId,
          provider: AuthProvider.GOOGLE,
          roles: defaultRole ? [defaultRole] : [],
        });

        const userSalvo = await em.save(User, novoUserGoogle);

        if (targetRoleName === 'professional')
          await this.appendProfessional(userSalvo.id, em);
        else if (targetRoleName === 'manager')
          await this.appendManager(userSalvo.id, em);
        else if (targetRoleName === 'client')
          await this.appendClient(userSalvo.id, em);

        return await this.findOne(userSalvo.id, em);
      },
    );
  }

  async updateGoogleId(id: string, googleId: string) {
    return await this.usersRepository.update(id, { googleId });
  }

  async findOne(id: string, manager?: EntityManager) {
    const repo = manager ? manager.getRepository(User) : this.usersRepository;

    const user = await repo.findOne({
      where: { id },
      relations: ['roles', 'client', 'professional', 'manager'],
    });

    if (!user) {
      throw new NotFoundException(
        'Usuário não encontrado em nossa base de dados.',
      );
    }

    return user;
  }

  async findAll() {
    return await this.usersRepository.find({
      relations: ['roles'],
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.findOne(id);

    if (updateUserDto.password) {
      if (!updateUserDto.currentPassword) {
        throw new UnauthorizedException(
          'A senha atual é necessária para modificar a sua senha.',
        );
      }

      const userWithHash = await this.usersRepository.findOne({
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
      user.passwordHash = await bcrypt.hash(updateUserDto.password, 10);
    }

    if (updateUserDto.nome) user.name = updateUserDto.nome;
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existing = await this.findByEmail(updateUserDto.email);
      if (existing) {
        throw new ConflictException('E-mail já cadastrado por outro usuário.');
      }
      user.email = updateUserDto.email;
    }

    const userAtualizado = await this.usersRepository.save(user);

    const userWithoutPasswordUpdated = omitPasswordHash(userAtualizado);

    return {
      ...userWithoutPasswordUpdated,
      roles: userWithoutPasswordUpdated.roles?.map((p: Role) => p.name) || [],
    };
  }

  async remove(id: string) {
    await this.findOne(id);

    await this.usersRepository.softDelete(id);

    return { message: 'Usuário excluído com sucesso.' };
  }

  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.roles', 'roles')
      .where('LOWER(user.email) = LOWER(:email)', {
        email: email.toLowerCase(),
      })
      .select([
        'user.id',
        'user.name',
        'user.email',
        'user.passwordHash',
        'user.provider',
        'roles.id',
        'roles.name',
      ])
      .getOne();
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
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
      await this.usersRepository.update(id, { passwordHash: hash });
    }
  }

  // =========================================================================

  async appendClient(userId: string, transactionManager?: EntityManager, photoUrl?: string | null) {
    const em = transactionManager || this.usersRepository.manager;

    const user = await em.findOne(User, {
      where: { id: userId },
      relations: ['roles', 'client'],
    });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    if (user.client) return user.client;

    await this.ensureRole(user, 'client', em);

    const client = em.create(Client, { user, photoUrl: photoUrl || undefined });
    return await em.save(Client, client);
  }

  async appendProfessional(userId: string, transactionManager?: EntityManager, profileData?: { specialty?: string; biography?: string; photoUrl?: string | null }) {
    const em = transactionManager || this.usersRepository.manager;

    const user = await em.findOne(User, {
      where: { id: userId },
      relations: ['roles', 'professional'],
    });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    if (user.professional) return user.professional;

    await this.ensureRole(user, 'professional', em);

    const professional = em.create(Professional, { 
      user,
      specialty: profileData?.specialty || undefined,
      biography: profileData?.biography || undefined,
      photoUrl: profileData?.photoUrl || undefined,
      profileComplete: !!(profileData?.specialty && profileData?.biography),
    });
    return await em.save(Professional, professional);
  }

  async appendManager(userId: string, transactionManager?: EntityManager, businessData?: { legalName?: string; cnpj?: string; tradeName?: string; phone?: string; photoUrl?: string | null; address?: { zipCode: string; street: string; number: string; complement?: string; neighborhood: string; city: string; state: string } }) {
    const em = transactionManager || this.usersRepository.manager;

    const user = await em.findOne(User, {
      where: { id: userId },
      relations: ['roles', 'manager'],
    });

    if (!user) throw new NotFoundException('Usuário não encontrado.');

    if (user.manager) return user.manager;

    await this.ensureRole(user, 'manager', em);

    const manager = em.create(Manager, { user });
    const savedManager = await em.save(Manager, manager);

    const business = em.create(Business, {
      tradeName: businessData?.tradeName || `Unidade ${user.name}`,
      legalName: businessData?.legalName || undefined,
      cnpj: businessData?.cnpj || undefined,
      phone: businessData?.phone || undefined,
      photoUrl: businessData?.photoUrl || undefined,
      visibilityStatus: false,
      profileComplete: false,
    });
    const savedBusiness = await em.save(Business, business);

    if (businessData?.address) {
      const address = em.create(Address, {
        ...businessData.address,
        business: savedBusiness,
      });
      await em.save(Address, address);
    }

    const businessLink = em.create(BusinessManager, {
      manager: savedManager,
      business: savedBusiness,
    });
    await em.save(BusinessManager, businessLink);

    return savedManager;
  }

  private async ensureRole(user: User, roleName: string, em: EntityManager) {
    if (!user.roles) user.roles = [];

    const hasRole = user.roles.some((r) => r.name === roleName);
    if (!hasRole) {
      const role = await em.findOne(Role, { where: { name: roleName } });
      if (role) {
        user.roles.push(role);
        await em.save(User, user);
      }
    }
  }

  async become_admin(userId: string, transactionManager?: EntityManager) {
    const em = transactionManager || this.usersRepository.manager;

    const user = await em.findOne(User, {
      where: { id: userId },
      relations: ['roles'],
    });

    if (!user) throw new NotFoundException('Usuário não encontrado.');

    await this.ensureRole(user, 'admin', em);

    return await this.findOne(userId, em);
  }
}
