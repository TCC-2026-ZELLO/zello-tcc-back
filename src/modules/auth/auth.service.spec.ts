import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'crypto';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { LoginAttemptLimiter } from './login-attempt.limiter';
import { AuthProvider } from '../users/entities/user.entity';
import { PasswordReset } from '../users/entities/password-reset.entity';
import { RefreshToken } from '../users/entities/refresh-token.entity';

jest.mock('bcrypt');

// Segredo fictício gerado no próprio teste (nenhum valor fixo no código).
const SECRET = 'jest-only-'.padEnd(48, 'x');

describe('AuthService', () => {
  let service: AuthService;
  let usersService: any;
  let mailerService: any;
  let jwtService: JwtService;
  let refreshTokenRepo: any;
  let passwordResetRepo: any;
  let dataSource: any;
  let updateQb: any;
  let resetQb: any;
  let txResetRepo: any;
  let txRefreshRepo: any;

  const mockUser = {
    id: 'uuid-1',
    email: 'teste@zello.com',
    name: 'Rafael <Admin> & "Co" \'Test\' /',
    provider: AuthProvider.LOCAL,
    passwordHash: 'hashed-pw',
    isActive: true,
    roles: [{ name: 'client' }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.FRONTEND_BASE_URL = 'https://app.zello.com.br';

    usersService = {
      findByEmailWithPassword: jest.fn(),
      findByEmail: jest.fn(),
      findOne: jest.fn().mockResolvedValue(mockUser),
      createViaGoogle: jest.fn(),
      updatePassword: jest.fn().mockResolvedValue(undefined),
    };
    mailerService = { sendMail: jest.fn().mockResolvedValue({}) };
    jwtService = new JwtService({
      secret: SECRET,
      signOptions: { algorithm: 'HS256' },
      verifyOptions: { algorithms: ['HS256'] },
    });

    const deleteQb = {
      delete: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({}),
    };
    refreshTokenRepo = {
      save: jest
        .fn()
        .mockImplementation(async (row) => ({ id: 'session-1', ...row })),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(deleteQb),
    };

    updateQb = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    dataSource = { createQueryBuilder: jest.fn().mockReturnValue(updateQb) };

    resetQb = {
      setLock: jest.fn().mockReturnThis(),
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    };
    txResetRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(resetQb),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    txRefreshRepo = { delete: jest.fn().mockResolvedValue({ affected: 2 }) };
    passwordResetRepo = {
      save: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      manager: {
        transaction: jest.fn().mockImplementation((cb) =>
          cb({
            getRepository: (entity: unknown) =>
              entity === PasswordReset
                ? txResetRepo
                : entity === RefreshToken
                  ? txRefreshRepo
                  : undefined,
          }),
        ),
      },
    };

    service = new AuthService(
      dataSource,
      usersService,
      refreshTokenRepo,
      passwordResetRepo,
      mailerService,
      jwtService,
      new LoginAttemptLimiter(),
    );
  });

  describe('validateUser', () => {
    it('deve retornar o usuário sem passwordHash quando credenciais forem válidas', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('teste@zello.com', 'senha');
      expect(result.id).toBe('uuid-1');
      expect(result.passwordHash).toBeUndefined();
    });

    it('deve responder de forma idêntica para e-mail inexistente, conta Google, conta inativa e senha errada', async () => {
      const attempt = async () => {
        try {
          await service.validateUser('teste@zello.com', 'senha');
          return 'ok';
        } catch (error) {
          expect(error).toBeInstanceOf(UnauthorizedException);
          return (error as Error).message;
        }
      };

      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      usersService.findByEmailWithPassword.mockResolvedValue(null);
      const missing = await attempt();
      // Mesmo sem usuário, o custo do bcrypt é pago (sem diferença de tempo).
      expect(bcrypt.compare).toHaveBeenCalledTimes(1);

      usersService.findByEmailWithPassword.mockResolvedValue({
        ...mockUser,
        provider: AuthProvider.GOOGLE,
      });
      const google = await attempt();

      usersService.findByEmailWithPassword.mockResolvedValue(mockUser);
      const wrongPassword = await attempt();

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      usersService.findByEmailWithPassword.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });
      const inactive = await attempt();

      expect(new Set([missing, google, wrongPassword, inactive]).size).toBe(1);
      expect(missing).toBe('E-mail ou senha incorretos.');
    });

    it('deve limitar tentativas por conta (v5.0.0-6.3.1)', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      for (let i = 0; i < 10; i++) {
        await expect(
          service.validateUser('teste@zello.com', 'errada'),
        ).rejects.toThrow(UnauthorizedException);
      }
      await expect(
        service.validateUser('teste@zello.com', 'errada'),
      ).rejects.toThrow('Muitas tentativas de login');
    });
  });

  describe('login, tokens e logout', () => {
    it('deve apagar sessões anteriores e emitir tokens HS256 de vida curta com tipos distintos', async () => {
      const result = await service.login(mockUser);

      expect(refreshTokenRepo.delete).toHaveBeenCalledWith({
        user: { id: 'uuid-1' },
      });
      expect(result.user).toEqual({
        id: 'uuid-1',
        name: mockUser.name,
        email: 'teste@zello.com',
        roles: ['client'],
        provider: AuthProvider.LOCAL,
      });

      const access = jwtService.decode(result.access_token, {
        complete: true,
      }) as any;
      expect(access.header.alg).toBe('HS256');
      expect(access.payload).toMatchObject({
        sub: 'uuid-1',
        sid: 'session-1',
        typ: 'access',
        iss: 'zello-api',
        aud: 'zello-web',
      });
      // Sem dados pessoais no token.
      expect(access.payload.email).toBeUndefined();
      expect(access.payload.exp - access.payload.iat).toBe(15 * 60);

      const refresh = jwtService.decode(result.refresh_token) as any;
      expect(refresh).toMatchObject({ typ: 'refresh', aud: 'zello-refresh' });
      expect(refresh.exp - refresh.iat).toBeLessThanOrEqual(30 * 60);
    });

    it('deve deletar todos os refresh tokens no logout', async () => {
      expect(await service.logout('uuid-1')).toEqual({
        message: 'Logout realizado com sucesso.',
      });
      expect(refreshTokenRepo.delete).toHaveBeenCalledWith({
        user: { id: 'uuid-1' },
      });
    });

    it('deve revogar sessões preservando opcionalmente a atual', async () => {
      refreshTokenRepo.delete.mockResolvedValue({ affected: 3 });
      expect(await service.revokeSessions('uuid-1')).toEqual({ revoked: 3 });
      await service.revokeSessions('uuid-1', 'session-1');
      const where = refreshTokenRepo.delete.mock.calls[1][0];
      expect(where.user).toEqual({ id: 'uuid-1' });
      expect(where.id).toBeDefined();
    });

    it('deve informar se a sessão continua ativa', async () => {
      refreshTokenRepo.findOne.mockResolvedValue(null);
      expect(await service.isSessionActive('uuid-1', 's1')).toBe(false);
      refreshTokenRepo.findOne.mockResolvedValue({
        expiresAt: new Date(Date.now() - 1000),
      });
      expect(await service.isSessionActive('uuid-1', 's1')).toBe(false);
      refreshTokenRepo.findOne.mockResolvedValue({
        expiresAt: new Date(Date.now() + 60_000),
      });
      expect(await service.isSessionActive('uuid-1', 's1')).toBe(true);
      expect(await service.isSessionActive('', '')).toBe(false);
    });

    it('deve limpar tokens expirados via queryBuilder', async () => {
      await service.limparTokensExpirados();
      expect(refreshTokenRepo.createQueryBuilder).toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    const issue = async () => {
      const tokens = await service.login(mockUser);
      const payload = jwtService.decode(tokens.refresh_token) as any;
      return { tokens, payload };
    };
    const session = (tokenId: string, overrides: Partial<RefreshToken> = {}) => ({
      id: 'session-1',
      tokenId,
      sessionStartedAt: new Date(),
      lastUsedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      ...overrides,
    });

    it('deve rotacionar o refresh token mantendo a mesma sessão', async () => {
      const { tokens, payload } = await issue();
      refreshTokenRepo.findOne.mockResolvedValue(session(payload.tokenId));

      const renewed = await service.refresh(tokens.refresh_token);
      const newPayload = jwtService.decode(renewed.refresh_token) as any;

      expect(newPayload.tokenId).not.toBe(payload.tokenId);
      expect(newPayload.sid).toBe('session-1');
      expect(updateQb.andWhere).toHaveBeenCalledWith('token_id = :tokenId', {
        tokenId: payload.tokenId,
      });
    });

    it('deve encerrar todas as sessões quando um refresh token é reutilizado', async () => {
      const { tokens } = await issue();
      refreshTokenRepo.delete.mockClear();

      // O token apresentado não é mais o vigente da sessão.
      refreshTokenRepo.findOne.mockResolvedValue(session('outro-token-id'));
      await expect(service.refresh(tokens.refresh_token)).rejects.toThrow(
        'Token já utilizado',
      );
      expect(refreshTokenRepo.delete).toHaveBeenCalledWith({
        user: { id: 'uuid-1' },
      });

      // Corrida: outra requisição trocou o token entre a leitura e a escrita.
      const { tokens: t2, payload: p2 } = await issue();
      refreshTokenRepo.findOne.mockResolvedValue(session(p2.tokenId));
      updateQb.execute.mockResolvedValue({ affected: 0 });
      await expect(service.refresh(t2.refresh_token)).rejects.toThrow(
        'Token já utilizado',
      );
    });

    it('deve expirar a sessão por inatividade e por vida máxima (v5.0.0-7.3.1, 7.3.2)', async () => {
      const { tokens, payload } = await issue();

      refreshTokenRepo.findOne.mockResolvedValue(
        session(payload.tokenId, {
          lastUsedAt: new Date(Date.now() - 31 * 60 * 1000),
        }),
      );
      await expect(service.refresh(tokens.refresh_token)).rejects.toThrow(
        'Sessão expirada',
      );

      refreshTokenRepo.findOne.mockResolvedValue(
        session(payload.tokenId, {
          sessionStartedAt: new Date(Date.now() - 8 * 24 * 3600 * 1000),
        }),
      );
      await expect(service.refresh(tokens.refresh_token)).rejects.toThrow(
        'Sessão expirada',
      );
    });

    it('deve recusar conta desativada, token de acesso, token adulterado e algoritmo "none"', async () => {
      const { tokens, payload } = await issue();
      refreshTokenRepo.findOne.mockResolvedValue(session(payload.tokenId));
      usersService.findOne.mockResolvedValue({ ...mockUser, isActive: false });
      await expect(service.refresh(tokens.refresh_token)).rejects.toThrow(
        'Sessão encerrada.',
      );

      // Token de acesso apresentado como refresh (audiência diferente).
      await expect(service.refresh(tokens.access_token)).rejects.toThrow(
        'Refresh token inválido.',
      );

      // Assinatura adulterada.
      await expect(
        service.refresh(`${tokens.refresh_token.slice(0, -2)}xx`),
      ).rejects.toThrow('Refresh token inválido.');

      // v5.0.0-9.1.2: token sem assinatura (alg none) é recusado.
      const b64 = (value: object) =>
        Buffer.from(JSON.stringify(value)).toString('base64url');
      const unsigned = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({
        ...payload,
        exp: Math.floor(Date.now() / 1000) + 600,
      })}.`;
      await expect(service.refresh(unsigned)).rejects.toThrow(
        'Refresh token inválido.',
      );

      // Assinado com outro algoritmo da família HMAC.
      const hs512 = new JwtService({ secret: SECRET }).sign(
        { sub: 'uuid-1', sid: 'session-1', tokenId: 't', typ: 'refresh' },
        {
          algorithm: 'HS512',
          issuer: 'zello-api',
          audience: 'zello-refresh',
          expiresIn: 600,
        },
      );
      await expect(service.refresh(hs512)).rejects.toThrow(
        'Refresh token inválido.',
      );
    });

    it('deve distinguir token expirado e token sem os claims esperados', async () => {
      const expired = jwtService.sign(
        { sub: 'uuid-1', sid: 's', tokenId: 't', typ: 'refresh' },
        { issuer: 'zello-api', audience: 'zello-refresh', expiresIn: -10 },
      );
      await expect(service.refresh(expired)).rejects.toThrow('Sessão expirada');

      const incomplete = jwtService.sign(
        { sub: 'uuid-1', typ: 'refresh' },
        { issuer: 'zello-api', audience: 'zello-refresh', expiresIn: 600 },
      );
      await expect(service.refresh(incomplete)).rejects.toThrow(
        'Token incompatível',
      );
    });
  });

  describe('validateGoogleUser', () => {
    const googleUser = {
      email: 'g@gmail.com',
      name: 'G',
      googleId: 'g-1',
      accountType: 'CLIENTE',
      emailVerified: true,
    };

    it('deve criar a sessão para e-mail verificado', async () => {
      usersService.createViaGoogle.mockResolvedValue(mockUser);
      const result = await service.validateGoogleUser(googleUser);
      expect(usersService.createViaGoogle).toHaveBeenCalledWith(
        'G',
        'g@gmail.com',
        'g-1',
        'CLIENTE',
      );
      expect(result.access_token).toBeDefined();
    });

    it('deve recusar e-mail não verificado e conta desativada', async () => {
      await expect(
        service.validateGoogleUser({ ...googleUser, emailVerified: false }),
      ).rejects.toThrow(ForbiddenException);
      expect(usersService.createViaGoogle).not.toHaveBeenCalled();

      usersService.createViaGoogle.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });
      await expect(service.validateGoogleUser(googleUser)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('forgotPassword', () => {
    const GENERIC =
      'Se o e-mail estiver cadastrado, um link de recuperação será enviado.';

    it('deve responder de forma genérica sem enviar e-mail para conta inexistente ou Google', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      expect((await service.forgotPassword('x@y.com')).message).toBe(GENERIC);

      usersService.findByEmail.mockResolvedValue({
        ...mockUser,
        provider: AuthProvider.GOOGLE,
      });
      expect((await service.forgotPassword('x@y.com')).message).toBe(GENERIC);
      expect(mailerService.sendMail).not.toHaveBeenCalled();
    });

    it('deve gerar token aleatório, guardar só o hash e enviar o link com o token no fragmento', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      const before = Date.now();
      const result = await service.forgotPassword(mockUser.email);
      expect(result.message).toBe(GENERIC);

      const saved = passwordResetRepo.save.mock.calls[0][0];
      const html: string = mailerService.sendMail.mock.calls[0][0].html;
      const match = html.match(
        /https:\/\/app\.zello\.com\.br\/redefinir-senha#token=([a-f0-9]{64})"/,
      );
      expect(match).not.toBeNull();
      const rawToken = (match as RegExpMatchArray)[1];

      // v5.0.0-14.2.1: o token não vai na query string.
      expect(html).not.toContain('?token=');
      // Só o hash SHA-256 é persistido; o token puro nunca vai ao banco.
      expect(saved.hashedToken).toBe(
        createHash('sha256').update(rawToken).digest('hex'),
      );
      expect(saved.hashedToken).not.toBe(rawToken);
      // v5.0.0-6.5.5: expiração de no máximo 10 minutos.
      const ttl = saved.expiresAt.getTime() - before;
      expect(ttl).toBeGreaterThan(9 * 60 * 1000);
      expect(ttl).toBeLessThanOrEqual(10 * 60 * 1000 + 1000);
      // Pedido anterior é invalidado.
      expect(passwordResetRepo.delete).toHaveBeenCalledWith({
        user: { id: 'uuid-1' },
      });
      // O nome do usuário é escapado no HTML do e-mail.
      expect(html).toContain('Rafael &lt;Admin&gt; &amp; &quot;Co&quot;');
      expect(html).not.toContain('<Admin>');
    });

    it('deve manter a resposta genérica sem FRONTEND_BASE_URL ou com falha no envio', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      delete process.env.FRONTEND_BASE_URL;
      expect((await service.forgotPassword(mockUser.email)).message).toBe(
        GENERIC,
      );
      expect(mailerService.sendMail).not.toHaveBeenCalled();

      process.env.FRONTEND_BASE_URL = 'https://app.zello.com.br';
      mailerService.sendMail.mockRejectedValue(new Error('SMTP fora do ar'));
      expect((await service.forgotPassword(mockUser.email)).message).toBe(
        GENERIC,
      );
    });
  });

  describe('resetPassword', () => {
    const dto = { token: 'a'.repeat(64), newPassword: 'frase bem comprida' };

    it('deve recusar token inexistente ou já utilizado', async () => {
      resetQb.getOne.mockResolvedValue(null);
      await expect(service.resetPassword(dto)).rejects.toThrow(
        'Token inválido ou já utilizado.',
      );
      expect(usersService.updatePassword).not.toHaveBeenCalled();
    });

    it('deve recusar e apagar token expirado', async () => {
      resetQb.getOne.mockResolvedValue({
        id: 'r1',
        expiresAt: new Date(Date.now() - 1000),
        user: { id: 'uuid-1' },
      });
      await expect(service.resetPassword(dto)).rejects.toThrow(
        'Este token expirou',
      );
      expect(txResetRepo.delete).toHaveBeenCalledWith('r1');
    });

    it('deve trocar a senha, encerrar todas as sessões e consumir o token', async () => {
      resetQb.getOne.mockResolvedValue({
        id: 'r1',
        expiresAt: new Date(Date.now() + 60_000),
        user: { id: 'uuid-1' },
      });

      expect(await service.resetPassword(dto)).toEqual({
        message: 'Senha atualizada com sucesso!',
      });
      expect(resetQb.where).toHaveBeenCalledWith(
        'passwordReset.hashedToken = :hashedToken',
        { hashedToken: createHash('sha256').update(dto.token).digest('hex') },
      );
      expect(usersService.updatePassword).toHaveBeenCalledWith(
        'uuid-1',
        dto.newPassword,
        expect.anything(),
      );
      expect(txRefreshRepo.delete).toHaveBeenCalledWith({
        user: { id: 'uuid-1' },
      });
      expect(txResetRepo.delete).toHaveBeenCalledWith('r1');
    });
  });
});
