import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthProvider, User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('UsersService', () => {
  let service: UsersService;
  let usersRepo: any;
  let rolesRepo: any;
  let filesService: any;
  let emMock: any;

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-pwd');
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const userRepoInTx = {
      findOne: jest.fn().mockResolvedValue({
        id: 'u1',
        name: 'User 1',
        email: 'u1@zello.com',
        roles: [{ name: 'client' }],
      }),
    };

    emMock = {
      create: jest.fn().mockImplementation((_entity, dto) => ({ id: 'id-1', ...dto })),
      save: jest.fn().mockImplementation(async (_entity, obj) => obj || { id: 'id-1' }),
      findOne: jest.fn().mockImplementation(async (entity) => {
        if (entity === User) {
          return { id: 'u1', name: 'User 1', roles: [] };
        }
        if (entity === Role) {
          return { id: 'r1', name: 'role' };
        }
        return null;
      }),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      getRepository: jest.fn().mockReturnValue(userRepoInTx),
    };

    const qbMock = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };

    usersRepo = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn().mockImplementation(async (u) => u),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      softDelete: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn().mockReturnValue(qbMock),
      manager: {
        transaction: jest.fn().mockImplementation((cb) => cb(emMock)),
        ...emMock,
      },
    };

    rolesRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((r) => r),
      save: jest.fn().mockImplementation(async (r) => r),
    };

    filesService = {
      uploadPublicFile: jest.fn().mockResolvedValue('https://cdn/photo.jpg'),
    };

    service = new UsersService(usersRepo, rolesRepo, filesService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should seed default roles onModuleInit', async () => {
    await service.onModuleInit();
    expect(rolesRepo.save).toHaveBeenCalledTimes(4);
  });

  describe('create', () => {
    it('should create a new CLIENT user with photo and address', async () => {
      const dto: any = {
        nome: 'Maria',
        email: 'maria@zello.com',
        password: 'Password@123',
        accountType: 'CLIENTE',
        clientZipCode: '80000000',
        clientStreet: 'Rua A',
        clientNumber: '10',
        clientNeighborhood: 'Centro',
        clientCity: 'Curitiba',
        clientState: 'PR',
      };

      const res = await service.create(dto, { buffer: Buffer.from('a') } as any);
      expect(filesService.uploadPublicFile).toHaveBeenCalledWith(
        expect.anything(),
        'client-photos',
      );
      expect(res.id).toBe('u1');
    });

    it('should create a new PROFISSIONAL user and ESTABELECIMENTO user', async () => {
      await service.create(
        {
          nome: 'Pro',
          email: 'pro@zello.com',
          password: 'Password@123',
          accountType: 'PROFISSIONAL',
          specialty: 'Corte',
          biography: 'Bio',
        } as any,
        { buffer: Buffer.from('a') } as any,
      );

      await service.create(
        {
          nome: 'Gestor',
          email: 'gestor@zello.com',
          password: 'Password@123',
          accountType: 'ESTABELECIMENTO',
          legalName: 'LTDA',
          tradeName: 'Salão',
          zipCode: '80000000',
          street: 'Rua B',
          addressNumber: '20',
          neighborhood: 'Batel',
          city: 'Curitiba',
          state: 'PR',
        } as any,
        { buffer: Buffer.from('a') } as any,
      );

      expect(filesService.uploadPublicFile).toHaveBeenCalledWith(
        expect.anything(),
        'avatars',
      );
      expect(filesService.uploadPublicFile).toHaveBeenCalledWith(
        expect.anything(),
        'business-photos',
      );
    });

    it('should throw ConflictException when existing user is GOOGLE or password does not match', async () => {
      jest.spyOn(service, 'findByEmailWithPassword').mockResolvedValue({
        id: 'u1',
        provider: AuthProvider.GOOGLE,
      } as any);

      await expect(
        service.create({ email: 'g@zello.com', password: '123' } as any),
      ).rejects.toThrow(ConflictException);

      jest.spyOn(service, 'findByEmailWithPassword').mockResolvedValue({
        id: 'u1',
        provider: AuthProvider.LOCAL,
        passwordHash: 'hash',
      } as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.create({ email: 'l@zello.com', password: 'wrong' } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('should append profile when existing user credentials match', async () => {
      jest.spyOn(service, 'findByEmailWithPassword').mockResolvedValue({
        id: 'u1',
        provider: AuthProvider.LOCAL,
        passwordHash: 'hash',
      } as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await service.create({
        email: 'l@zello.com',
        password: 'ok',
        accountType: 'PROFISSIONAL',
      } as any);

      await service.create({
        email: 'l@zello.com',
        password: 'ok',
        accountType: 'ESTABELECIMENTO',
        zipCode: '80000000',
      } as any);

      await service.create({
        email: 'l@zello.com',
        password: 'ok',
        accountType: 'CLIENTE',
      } as any);

      expect(emMock.save).toHaveBeenCalled();
    });
  });

  describe('createViaGoogle', () => {
    it('should link googleId and append role if user already exists', async () => {
      usersRepo.findOne.mockResolvedValue({
        id: 'u1',
        email: 'u1@zello.com',
        googleId: null,
        roles: [],
        client: null,
        professional: null,
        manager: null,
      });

      const res = await service.createViaGoogle(
        'User 1',
        'u1@zello.com',
        'gid-1',
        'PROFISSIONAL',
      );
      expect(usersRepo.save).toHaveBeenCalled();
      expect(res.id).toBe('u1');
    });

    it('should create new Google user when not existing', async () => {
      usersRepo.findOne.mockResolvedValue(null);
      rolesRepo.findOne.mockResolvedValue({ id: 'r1', name: 'client' });

      const res = await service.createViaGoogle(
        'Novo Google',
        'novo@zello.com',
        'gid-2',
        'CLIENTE',
      );
      expect(res.id).toBe('u1');
    });
  });

  describe('update, remove, and helpers', () => {
    it('should update user fields and password when currentPassword is valid', async () => {
      usersRepo.findOne
        .mockResolvedValueOnce({
          id: 'u1',
          name: 'Old',
          email: 'old@zello.com',
          roles: [{ name: 'client' }],
        })
        .mockResolvedValueOnce({
          id: 'u1',
          passwordHash: 'old-hash',
        })
        .mockResolvedValueOnce(null); // findByEmail check

      const updated = await service.update('u1', {
        nome: 'New Name',
        email: 'new@zello.com',
        currentPassword: 'old',
        password: 'new',
        wantsEmailReminders: false,
        wantsWhatsappReminders: false,
      });

      expect(updated.name).toBe('New Name');
      expect(updated.email).toBe('new@zello.com');
      expect(updated.roles).toEqual(['client']);
    });

    it('should throw UnauthorizedException or ConflictException on invalid update conditions', async () => {
      usersRepo.findOne.mockResolvedValue({
        id: 'u1',
        email: 'old@zello.com',
      });

      await expect(
        service.update('u1', { password: 'new' }),
      ).rejects.toThrow(UnauthorizedException);

      usersRepo.findOne
        .mockResolvedValueOnce({ id: 'u1', email: 'old@zello.com' })
        .mockResolvedValueOnce({ id: 'u1', passwordHash: null });

      await expect(
        service.update('u1', { currentPassword: 'a', password: 'b' }),
      ).rejects.toThrow(UnauthorizedException);

      usersRepo.findOne
        .mockResolvedValueOnce({ id: 'u1', email: 'old@zello.com' })
        .mockResolvedValueOnce({ id: 'u1', id2: 1 }); // findByEmail returns existing user

      await expect(
        service.update('u1', { email: 'taken@zello.com' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should soft delete user on remove', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'u1' });
      const res = await service.remove('u1');
      expect(usersRepo.softDelete).toHaveBeenCalledWith('u1');
      expect(res).toEqual({ message: 'Usuário excluído com sucesso.' });
    });

    it('should throw NotFoundException in findOne when user does not exist', async () => {
      usersRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should execute findAll, updateGoogleId, updatePassword, become_admin', async () => {
      await service.findAll();
      await service.updateGoogleId('u1', 'gid');
      await service.updatePassword('u1', 'newpass');
      await service.updatePassword('u1', 'newpass', emMock);
      const admin = await service.become_admin('u1', emMock);
      expect(admin.id).toBe('u1');
    });
  });
});
