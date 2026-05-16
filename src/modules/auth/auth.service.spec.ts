import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RefreshToken } from '../users/entities/refresh-token.entity';
import { PasswordReset } from '../users/entities/password-reset.entity';
import { MailerService } from '@nestjs-modules/mailer';
import { DataSource } from 'typeorm';
import { UnauthorizedException } from '@nestjs/common';
import { AuthProvider } from '../users/entities/user.entity';
import { createHash } from 'crypto';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersService;
  let mailerService: MailerService;
  let refreshTokenRepo: any;

  const mockUser = {
    id: 'uuid-1',
    email: 'teste@zello.com',
    nome: 'Rafael',
    provider: AuthProvider.LOCAL,
  };

  const queryBuilderMock = {
    setLock: jest.fn().mockReturnThis(),
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
  };

  const passwordResetRepoMock = {
    save: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
    findOne: jest.fn(),
    manager: {
      transaction: jest.fn().mockImplementation((cb) =>
        cb({
          getRepository: jest.fn().mockImplementation((entity) => {
            if (entity === PasswordReset) {
              return {
                createQueryBuilder: jest.fn().mockReturnValue(queryBuilderMock),
                delete: jest.fn().mockResolvedValue({ affected: 1 }),
              };
            }
            if (entity === RefreshToken) {
              return { delete: jest.fn().mockResolvedValue({ affected: 1 }) };
            }
          }),
        }),
      ),
    },
  };

  const refreshTokenRepoMock = {
    save: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
    createQueryBuilder: jest.fn().mockReturnValue({
      delete: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({}),
    }),
  };

  const dataSourceMock = {
    createQueryBuilder: jest.fn().mockReturnValue({
      delete: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    queryBuilderMock.setLock.mockReturnThis();
    queryBuilderMock.innerJoinAndSelect.mockReturnThis();
    queryBuilderMock.where.mockReturnThis();

    passwordResetRepoMock.save.mockResolvedValue({});
    passwordResetRepoMock.delete.mockResolvedValue({ affected: 1 });
    refreshTokenRepoMock.save.mockResolvedValue({});
    refreshTokenRepoMock.delete.mockResolvedValue({ affected: 1 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
            findByEmailWithPassword: jest.fn(),
            findOne: jest.fn(),
            updatePassword: jest.fn(),
            createViaGoogle: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('fake.jwt.token'),
            verify: jest.fn(),
          },
        },
        {
          provide: MailerService,
          useValue: { sendMail: jest.fn().mockResolvedValue(true) },
        },
        { provide: DataSource, useValue: dataSourceMock },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: refreshTokenRepoMock,
        },
        {
          provide: getRepositoryToken(PasswordReset),
          useValue: passwordResetRepoMock,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    mailerService = module.get<MailerService>(MailerService);
    refreshTokenRepo = module.get(getRepositoryToken(RefreshToken));
  });

  describe('forgotPassword', () => {
    beforeEach(() => {
      process.env.FRONTEND_BASE_URL = 'http://localhost:4200';
    });

    it('deve salvar token e enviar e-mail se o usuário for LOCAL', async () => {
      jest
        .spyOn(usersService, 'findByEmail')
        .mockResolvedValue(mockUser as any);

      const result = await service.forgotPassword('teste@zello.com');

      expect(passwordResetRepoMock.save).toHaveBeenCalled();
      expect(mailerService.sendMail).toHaveBeenCalled();
      expect(result.message).toContain('link de recuperação será enviado');
    });

    it('deve retornar mensagem genérica sem chamar sendMail se usuário não existir', async () => {
      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null);

      const result = await service.forgotPassword('naoexiste@zello.com');

      expect(mailerService.sendMail).not.toHaveBeenCalled();
      expect(passwordResetRepoMock.save).not.toHaveBeenCalled();
      expect(result.message).toContain('link de recuperação será enviado');
    });

    it('deve retornar mensagem genérica sem chamar sendMail se usuário for GOOGLE', async () => {
      jest.spyOn(usersService, 'findByEmail').mockResolvedValue({
        ...mockUser,
        provider: AuthProvider.GOOGLE,
      } as any);

      const result = await service.forgotPassword('google@zello.com');

      expect(mailerService.sendMail).not.toHaveBeenCalled();
      expect(result.message).toContain('link de recuperação será enviado');
    });
  });

  describe('resetPassword', () => {
    it('deve lançar UnauthorizedException se o token não existir no banco', async () => {
      queryBuilderMock.getOne.mockResolvedValue(null);

      await expect(
        service.resetPassword({
          token: 'token-invalido',
          newPassword: 'Senha@123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('deve lançar UnauthorizedException se o token estiver expirado', async () => {
      const rawToken = 'token-expirado';
      const hashedToken = createHash('sha256').update(rawToken).digest('hex');

      queryBuilderMock.getOne.mockResolvedValue({
        id: 'reset-id-1',
        hashedToken,
        usuario: mockUser,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(
        service.resetPassword({ token: rawToken, newPassword: 'Senha@123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('deve chamar updatePassword com os argumentos corretos quando o token é válido', async () => {
      const rawToken = 'token-valido';
      const hashedToken = createHash('sha256').update(rawToken).digest('hex');

      queryBuilderMock.getOne.mockResolvedValue({
        id: 'reset-id-2',
        hashedToken,
        usuario: mockUser,
        expiresAt: new Date(Date.now() + 60_000),
      });

      await service.resetPassword({
        token: rawToken,
        newPassword: 'NovaSenha@123',
      });

      expect(usersService.updatePassword).toHaveBeenCalledWith(
        mockUser.id,
        'NovaSenha@123',
        expect.anything(),
      );
      expect(usersService.updatePassword).toHaveBeenCalledTimes(1);
    });

    it('deve retornar mensagem de sucesso após resetar a senha', async () => {
      const rawToken = 'token-sucesso';
      const hashedToken = createHash('sha256').update(rawToken).digest('hex');

      queryBuilderMock.getOne.mockResolvedValue({
        id: 'reset-id-3',
        hashedToken,
        usuario: mockUser,
        expiresAt: new Date(Date.now() + 60_000),
      });

      const result = await service.resetPassword({
        token: rawToken,
        newPassword: 'NovaSenha@123',
      });

      expect(result).toEqual({ message: 'Senha atualizada com sucesso!' });
    });
  });

  describe('login', () => {
    it('deve apagar sessões anteriores e gerar novos tokens', async () => {
      const user = { ...mockUser, papeis: [] };

      await service.login(user);

      expect(refreshTokenRepo.delete).toHaveBeenCalledWith({
        usuario: { id: user.id },
      });
      expect(refreshTokenRepo.save).toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('deve deletar todos os refresh tokens e retornar mensagem de sucesso', async () => {
      const result = await service.logout('uuid-1');

      expect(refreshTokenRepo.delete).toHaveBeenCalledWith({
        usuario: { id: 'uuid-1' },
      });
      expect(result).toEqual({ message: 'Logout realizado com sucesso.' });
    });
  });
});
