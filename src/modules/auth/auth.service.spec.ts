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
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersService;
  let mailerService: MailerService;
  let jwtService: JwtService;
  let refreshTokenRepo: any;

  const mockUser = {
    id: 'uuid-1',
    email: 'teste@zello.com',
    name: 'Rafael <Admin> & "Co" \'Test\' /',
    provider: AuthProvider.LOCAL,
    passwordHash: 'hashed-pw',
    roles: [{ name: 'client' }],
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

  const refreshTokenQbMock = {
    delete: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({}),
  };

  const refreshTokenRepoMock = {
    save: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
    createQueryBuilder: jest.fn().mockReturnValue(refreshTokenQbMock),
  };

  const dataSourceQbMock = {
    delete: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected: 1 }),
  };

  const dataSourceMock = {
    createQueryBuilder: jest.fn().mockReturnValue(dataSourceQbMock),
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
    dataSourceQbMock.execute.mockResolvedValue({ affected: 1 });

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
    jwtService = module.get<JwtService>(JwtService);
    refreshTokenRepo = module.get(getRepositoryToken(RefreshToken));
  });

  describe('validateUser', () => {
    it('deve lançar UnauthorizedException se o usuário não existir', async () => {
      jest
        .spyOn(usersService, 'findByEmailWithPassword')
        .mockResolvedValue(null);

      await expect(
        service.validateUser('naoexiste@zello.com', '123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('deve lançar UnauthorizedException se o provider for GOOGLE', async () => {
      jest.spyOn(usersService, 'findByEmailWithPassword').mockResolvedValue({
        ...mockUser,
        provider: AuthProvider.GOOGLE,
      } as any);

      await expect(
        service.validateUser('google@zello.com', '123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('deve lançar UnauthorizedException se a senha não conferir', async () => {
      jest
        .spyOn(usersService, 'findByEmailWithPassword')
        .mockResolvedValue(mockUser as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.validateUser('teste@zello.com', 'errada'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('deve retornar o usuário sem passwordHash quando credenciais forem válidas', async () => {
      jest
        .spyOn(usersService, 'findByEmailWithPassword')
        .mockResolvedValue(mockUser as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const res = await service.validateUser('teste@zello.com', 'correta');
      expect(res.id).toBe('uuid-1');
      expect(res.passwordHash).toBeUndefined();
    });
  });

  describe('refresh & limparTokensExpirados & validateGoogleUser', () => {
    it('deve lançar erro de sessão expirada quando jwtService.verify lançar TokenExpiredError', async () => {
      const expiredErr = new Error('expired');
      expiredErr.name = 'TokenExpiredError';
      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw expiredErr;
      });

      await expect(service.refresh('exp-token')).rejects.toThrow(
        'Sessão expirada. Faça login novamente.',
      );
    });

    it('deve lançar erro de token inválido para outros erros de verify', async () => {
      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw new Error('invalid');
      });

      await expect(service.refresh('bad-token')).rejects.toThrow(
        'Refresh token inválido.',
      );
    });

    it('deve lançar erro se payload não contiver tokenId', async () => {
      jest.spyOn(jwtService, 'verify').mockReturnValue({ sub: 'uuid-1' });

      await expect(service.refresh('no-token-id')).rejects.toThrow(
        'Token incompatível. Faça login novamente.',
      );
    });

    it('deve revogar todas as sessões se o token já tiver sido utilizado (affected === 0)', async () => {
      jest
        .spyOn(jwtService, 'verify')
        .mockReturnValue({ sub: 'uuid-1', tokenId: 't-1' });
      dataSourceQbMock.execute.mockResolvedValue({ affected: 0 });

      await expect(service.refresh('reused-token')).rejects.toThrow(
        'Token já utilizado. Por segurança, todas as sessões foram encerradas.',
      );
      expect(refreshTokenRepo.delete).toHaveBeenCalledWith({
        user: { id: 'uuid-1' },
      });
    });

    it('deve renovar tokens quando refreshToken for válido', async () => {
      jest
        .spyOn(jwtService, 'verify')
        .mockReturnValue({ sub: 'uuid-1', tokenId: 't-1' });
      dataSourceQbMock.execute.mockResolvedValue({ affected: 1 });
      jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUser as any);

      const res = await service.refresh('valid-token');
      expect(res.access_token).toBe('fake.jwt.token');
      expect(res.user.id).toBe('uuid-1');
    });

    it('deve limpar tokens expirados via queryBuilder', async () => {
      await service.limparTokensExpirados();
      expect(refreshTokenQbMock.execute).toHaveBeenCalled();
    });

    it('deve validar usuário Google e gerar tokens', async () => {
      jest
        .spyOn(usersService, 'createViaGoogle')
        .mockResolvedValue({ ...mockUser, roles: undefined } as any);

      const res = await service.validateGoogleUser({
        email: 'g@zello.com',
        name: 'Google User',
        googleId: 'gid-1',
        accountType: 'CLIENTE',
      });

      expect(usersService.createViaGoogle).toHaveBeenCalledWith(
        'Google User',
        'g@zello.com',
        'gid-1',
        'CLIENTE',
      );
      expect(res.access_token).toBe('fake.jwt.token');
    });
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

    it('deve retornar resposta genérica se FRONTEND_BASE_URL não estiver definida', async () => {
      delete process.env.FRONTEND_BASE_URL;
      jest
        .spyOn(usersService, 'findByEmail')
        .mockResolvedValue(mockUser as any);

      const result = await service.forgotPassword('teste@zello.com');

      expect(mailerService.sendMail).not.toHaveBeenCalled();
      expect(result.message).toContain('link de recuperação será enviado');
    });

    it('deve capturar erro do mailerService sem quebrar o retorno', async () => {
      jest
        .spyOn(usersService, 'findByEmail')
        .mockResolvedValue(mockUser as any);
      jest
        .spyOn(mailerService, 'sendMail')
        .mockRejectedValue(new Error('SMTP error'));

      const result = await service.forgotPassword('teste@zello.com');
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
        user: mockUser,
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
        user: mockUser,
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
        user: mockUser,
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
      const user = { ...mockUser, roles: [] };

      await service.login(user);

      expect(refreshTokenRepo.delete).toHaveBeenCalledWith({
        user: { id: user.id },
      });
      expect(refreshTokenRepo.save).toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('deve deletar todos os refresh tokens e retornar mensagem de sucesso', async () => {
      const result = await service.logout('uuid-1');

      expect(refreshTokenRepo.delete).toHaveBeenCalledWith({
        user: { id: 'uuid-1' },
      });
      expect(result).toEqual({ message: 'Logout realizado com sucesso.' });
    });
  });
});
