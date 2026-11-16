import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RolesGuard } from './guards/roles.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { OAuthStateStore } from './strategies/oauth-state.store';
import { LoginAttemptLimiter } from './login-attempt.limiter';

describe('AuthController, Guards & Strategies', () => {
  describe('AuthController', () => {
    let controller: AuthController;
    let authService: any;
    let securityEvents: any;
    let mockRes: any;
    const req = { method: 'POST', originalUrl: '/auth/login', headers: {} };

    beforeEach(() => {
      authService = {
        validateUser: jest.fn(),
        login: jest.fn(),
        logout: jest.fn(),
        refresh: jest.fn(),
        validateGoogleUser: jest.fn(),
        forgotPassword: jest.fn(),
        resetPassword: jest.fn(),
      };
      securityEvents = { log: jest.fn() };
      controller = new AuthController(
        authService as AuthService,
        securityEvents,
      );
      mockRes = {
        cookie: jest.fn(),
        clearCookie: jest.fn(),
        setHeader: jest.fn(),
        redirect: jest.fn().mockReturnValue('redirected'),
      };
    });

    it('should login, set HttpOnly cookies and never return tokens in the body', async () => {
      authService.validateUser.mockResolvedValue({ id: 'u1' });
      authService.login.mockResolvedValue({
        access_token: 'at',
        refresh_token: 'rt',
        refresh_expires_at: new Date(Date.now() + 60_000),
        user: { id: 'u1', email: 'a@b.com' },
      });

      const res = await controller.login(
        { email: 'a@b.com', password: '123' },
        mockRes,
        req,
      );

      expect(mockRes.cookie).toHaveBeenCalledTimes(2);
      for (const call of mockRes.cookie.mock.calls) {
        expect(call[2]).toMatchObject({ httpOnly: true, path: '/' });
        expect(['lax', 'strict', 'none']).toContain(call[2].sameSite);
      }
      expect(res).toEqual({ user: { id: 'u1', email: 'a@b.com' } });
      expect(JSON.stringify(res)).not.toContain('at');
      expect(securityEvents.log).toHaveBeenCalledWith('login_success', req, {
        userId: 'u1',
      });
    });

    it('should log failed logins without the submitted credentials', async () => {
      authService.validateUser.mockRejectedValue(new UnauthorizedException());
      await expect(
        controller.login({ email: 'a@b.com', password: 'x' }, mockRes, req),
      ).rejects.toThrow(UnauthorizedException);
      expect(securityEvents.log).toHaveBeenCalledWith('login_failure', req);
      expect(mockRes.cookie).not.toHaveBeenCalled();
    });

    it('should logout, destroy the session, clear cookies and send Clear-Site-Data', async () => {
      const res = await controller.logout({ user: { id: 'u1' } }, mockRes);
      expect(mockRes.clearCookie).toHaveBeenCalledTimes(2);
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Clear-Site-Data',
        '"cache", "cookies", "storage"',
      );
      expect(authService.logout).toHaveBeenCalledWith('u1');
      expect(res).toEqual({ message: 'Logged out successfully' });
    });

    it('should return the authenticated profile', () => {
      expect(controller.getProfile({ user: { id: 'u1' } })).toEqual({
        user: { id: 'u1' },
      });
    });

    it('should refresh using the cookie and rotate both cookies', async () => {
      await expect(controller.refresh({ cookies: {} }, mockRes)).rejects.toThrow(
        UnauthorizedException,
      );

      authService.refresh.mockResolvedValue({
        access_token: 'at2',
        refresh_token: 'rt2',
        user: { id: 'u1' },
      });
      const res = await controller.refresh(
        { cookies: { refresh_token: 'rt' } },
        mockRes,
      );
      expect(authService.refresh).toHaveBeenCalledWith('rt');
      expect(mockRes.cookie).toHaveBeenCalledTimes(2);
      expect(res).toEqual({ user: { id: 'u1' } });
    });

    it('should clear cookies when the refresh token is rejected', async () => {
      authService.refresh.mockRejectedValue(new UnauthorizedException());
      await expect(
        controller.refresh({ cookies: { refresh_token: 'rt' } }, mockRes),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockRes.clearCookie).toHaveBeenCalledTimes(2);
      expect(securityEvents.log).toHaveBeenCalledWith(
        'token_refresh_failure',
        expect.anything(),
      );
    });

    describe('googleAuthRedirect', () => {
      const original = { ...process.env };
      afterEach(() => {
        process.env = { ...original };
      });
      beforeEach(() => {
        authService.validateGoogleUser.mockResolvedValue({
          access_token: 'at',
          refresh_token: 'rt',
          user: { id: 'u1' },
        });
      });

      it('should redirect using GOOGLE_REDIRECT_URL', async () => {
        process.env.GOOGLE_REDIRECT_URL = 'https://app.zello.com.br/explore';
        await controller.googleAuth({});
        const out = await controller.googleAuthRedirect({ user: {} }, mockRes);
        expect(mockRes.cookie).toHaveBeenCalledTimes(2);
        expect(mockRes.redirect).toHaveBeenCalledWith(
          'https://app.zello.com.br/explore',
        );
        expect(out).toBe('redirected');
      });

      it('should fall back to FRONTEND_BASE_URL', async () => {
        delete process.env.GOOGLE_REDIRECT_URL;
        process.env.FRONTEND_BASE_URL = 'https://app.zello.com.br';
        await controller.googleAuthRedirect({ user: {} }, mockRes);
        expect(mockRes.redirect).toHaveBeenCalledWith(
          'https://app.zello.com.br/explore',
        );
      });

      it('should fail without a configured redirect or with an unsafe protocol', async () => {
        delete process.env.GOOGLE_REDIRECT_URL;
        delete process.env.FRONTEND_BASE_URL;
        await expect(
          controller.googleAuthRedirect({ user: {} }, mockRes),
        ).rejects.toThrow('Missing redirect URL configuration');

        process.env.GOOGLE_REDIRECT_URL = 'javascript:alert(1)';
        await expect(
          controller.googleAuthRedirect({ user: {} }, mockRes),
        ).rejects.toThrow('Invalid redirect URL protocol.');
      });
    });

    it('should delegate forgotPassword and resetPassword and log the outcome', async () => {
      authService.forgotPassword.mockResolvedValue({ message: 'ok' });
      expect(await controller.forgotPassword({ email: 'a@b.com' }, req)).toEqual(
        { message: 'ok' },
      );

      authService.resetPassword.mockResolvedValue({ message: 'done' });
      const dto = { token: 'a'.repeat(64), newPassword: 'frase bem comprida' };
      expect(await controller.resetPassword(dto, req)).toEqual({
        message: 'done',
      });
      expect(securityEvents.log).toHaveBeenCalledWith(
        'password_reset_completed',
        req,
      );

      authService.resetPassword.mockRejectedValue(new UnauthorizedException());
      await expect(controller.resetPassword(dto, req)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(securityEvents.log).toHaveBeenCalledWith(
        'password_reset_failure',
        req,
      );
    });
  });

  describe('RolesGuard & GoogleAuthGuard', () => {
    const ctx = (user: any) =>
      ({
        getHandler: () => null,
        getClass: () => null,
        switchToHttp: () => ({ getRequest: () => ({ user }) }),
      }) as any;

    it('RolesGuard should deny when no roles are declared (fail closed)', () => {
      const guard = new RolesGuard({
        getAllAndOverride: () => undefined,
      } as any);
      expect(() => guard.canActivate(ctx({ roles: ['admin'] }))).toThrow(
        ForbiddenException,
      );
    });

    it('RolesGuard should allow matching role and deny others', () => {
      const guard = new RolesGuard({
        getAllAndOverride: () => ['manager'],
      } as any);
      expect(guard.canActivate(ctx({ roles: ['manager'] }))).toBe(true);
      expect(() => guard.canActivate(ctx({ roles: ['client'] }))).toThrow(
        ForbiddenException,
      );
    });

    it('GoogleAuthGuard should only pass an allowlisted account type and never use it as state', () => {
      const guard = new GoogleAuthGuard();
      const withRole: any = {
        switchToHttp: () => ({
          getRequest: () => ({ query: { role: 'PROFISSIONAL' } }),
        }),
      };
      expect(guard.getAuthenticateOptions(withRole)).toEqual({
        state: { accountType: 'PROFISSIONAL' },
        session: false,
      });

      const forged: any = {
        switchToHttp: () => ({
          getRequest: () => ({ query: { role: 'admin' } }),
        }),
      };
      expect(guard.getAuthenticateOptions(forged)).toEqual({
        state: { accountType: null },
        session: false,
      });
    });
  });

  describe('OAuthStateStore (v5.0.0-10.1.2)', () => {
    const makeReq = () => {
      const jar: Record<string, string> = {};
      const req: any = {
        cookies: jar,
        res: {
          cookie: jest.fn((name: string, value: string) => {
            jar[name] = value;
          }),
          clearCookie: jest.fn((name: string) => {
            delete jar[name];
          }),
        },
      };
      return req;
    };
    const store = new OAuthStateStore('segredo-de-teste');
    const save = (req: any, accountType?: string) =>
      new Promise<string>((resolve, reject) =>
        store.store(req, 'verifier-123', { accountType }, {}, (err, state) =>
          err ? reject(err) : resolve(state as string),
        ),
      );
    const check = (req: any, state: string) =>
      new Promise<string | false | undefined>((resolve) =>
        store.verify(req, state, (_err, ok) => resolve(ok)),
      );

    it('binds a random state to the browser and returns the PKCE verifier once', async () => {
      const req = makeReq();
      const state = await save(req, 'CLIENTE');
      expect(state.length).toBeGreaterThanOrEqual(43);
      expect(req.res.cookie.mock.calls[0][2]).toMatchObject({
        httpOnly: true,
        sameSite: 'lax',
      });

      const callbackReq: any = { cookies: { ...req.cookies }, res: req.res };
      expect(await check(callbackReq, state)).toBe('verifier-123');
      expect(callbackReq.oauthAccountType).toBe('CLIENTE');
      expect(req.res.clearCookie).toHaveBeenCalled();
    });

    it('rejects a missing cookie, a different state and a tampered cookie', async () => {
      const req = makeReq();
      const state = await save(req, 'CLIENTE');
      const cookieName = Object.keys(req.cookies)[0];
      const cookieValue = req.cookies[cookieName];

      // Resposta de autorização entregue a outro navegador (sem o cookie).
      expect(await check({ cookies: {}, res: req.res }, state)).toBe(false);
      // State diferente do emitido para este navegador.
      expect(
        await check(
          { cookies: { [cookieName]: cookieValue }, res: req.res },
          'outro-state',
        ),
      ).toBe(false);
      // Cookie adulterado.
      expect(
        await check(
          { cookies: { [cookieName]: `${cookieValue}x` }, res: req.res },
          state,
        ),
      ).toBe(false);
    });

    it('requires a secret and an HTTP response', async () => {
      expect(() => new OAuthStateStore('')).toThrow();
      await expect(save({ cookies: {} })).rejects.toThrow();
    });
  });

  describe('LoginAttemptLimiter (v5.0.0-6.3.1)', () => {
    it('blocks an account after repeated failures and recovers after the window', () => {
      const limiter = new LoginAttemptLimiter();
      const start = 1_000_000;
      for (let i = 0; i < 10; i++) limiter.registerFailure('Ana@Zello.com', start);
      expect(() => limiter.assertNotLocked('ana@zello.com', start + 1)).toThrow(
        'Muitas tentativas',
      );
      // Outra conta não é afetada.
      expect(() =>
        limiter.assertNotLocked('outra@zello.com', start + 1),
      ).not.toThrow();
      // Passada a janela de 15 minutos, a conta volta a aceitar tentativas.
      expect(() =>
        limiter.assertNotLocked('ana@zello.com', start + 16 * 60 * 1000),
      ).not.toThrow();

      limiter.registerFailure('x@zello.com', start);
      limiter.registerSuccess('x@zello.com');
      expect(() => limiter.assertNotLocked('x@zello.com', start)).not.toThrow();
    });
  });

  describe('JwtStrategy & GoogleStrategy', () => {
    const configService: any = { get: jest.fn().mockReturnValue('secret') };
    const accessPayload = { sub: 'u1', sid: 's1', typ: 'access' };

    it('JwtStrategy should throw if JWT_SECRET is missing', () => {
      const prev = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;
      expect(
        () =>
          new JwtStrategy(
            {} as any,
            { get: jest.fn().mockReturnValue(undefined) } as any,
            {} as any,
          ),
      ).toThrow('JWT_SECRET environment variable must be defined');
      process.env.JWT_SECRET = prev;
    });

    it('JwtStrategy should validate user and session, map roles and read the cookie', async () => {
      const usersService: any = {
        findOne: jest.fn().mockResolvedValue({
          id: 'u1',
          isActive: true,
          roles: [{ name: 'manager' }],
        }),
      };
      const authService: any = {
        isSessionActive: jest.fn().mockResolvedValue(true),
      };
      const strategy = new JwtStrategy(
        usersService,
        configService,
        authService,
      ) as any;

      const validated = await strategy.validate(accessPayload);
      expect(validated.roles).toEqual(['manager']);
      expect(validated.sessionId).toBe('s1');
      expect(authService.isSessionActive).toHaveBeenCalledWith('u1', 's1');

      expect(
        strategy._jwtFromRequest({
          headers: {},
          cookies: { access_token: 'cookie-jwt' },
        }),
      ).toBe('cookie-jwt');
      expect(strategy._jwtFromRequest({ headers: {} })).toBeNull();
      // v5.0.0-9.1.2: só HS256 é aceito na verificação.
      expect(strategy._verifOpts.algorithms).toEqual(['HS256']);
      expect(strategy._verifOpts.ignoreExpiration).toBe(false);
    });

    it('JwtStrategy should reject refresh tokens, revoked sessions and disabled accounts', async () => {
      const usersService: any = {
        findOne: jest.fn().mockResolvedValue({ id: 'u1', isActive: true }),
      };
      const authService: any = {
        isSessionActive: jest.fn().mockResolvedValue(false),
      };
      const strategy = new JwtStrategy(usersService, configService, authService);

      // Refresh token usado como token de acesso.
      await expect(
        strategy.validate({ sub: 'u1', sid: 's1', typ: 'refresh' }),
      ).rejects.toThrow(UnauthorizedException);
      // Sessão encerrada (logout, troca de senha, encerramento administrativo).
      await expect(strategy.validate(accessPayload)).rejects.toThrow(
        'Sessão encerrada.',
      );
      // Conta desativada.
      authService.isSessionActive.mockResolvedValue(true);
      usersService.findOne.mockResolvedValue({ id: 'u1', isActive: false });
      await expect(strategy.validate(accessPayload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('JwtStrategy should throw UnauthorizedException when user not found or rethrow unexpected error', async () => {
      const usersService: any = {
        findOne: jest.fn().mockRejectedValue(new NotFoundException()),
      };
      const strategy = new JwtStrategy(usersService, configService, {
        isSessionActive: jest.fn(),
      } as any);

      await expect(strategy.validate(accessPayload)).rejects.toThrow(
        UnauthorizedException,
      );

      usersService.findOne.mockRejectedValue(new Error('DB crash'));
      await expect(strategy.validate(accessPayload)).rejects.toThrow(
        'DB crash',
      );

      usersService.findOne.mockResolvedValue(null);
      await expect(strategy.validate(accessPayload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('GoogleStrategy should use state + PKCE and take the account type from the signed cookie', async () => {
      process.env.GOOGLE_CLIENT_ID = 'cid';
      process.env.GOOGLE_CLIENT_SECRET = 'csec';
      process.env.GOOGLE_CALLBACK_URL = 'http://localhost/cb';
      process.env.JWT_SECRET = process.env.JWT_SECRET || 'segredo-de-teste';

      const strategy = new GoogleStrategy() as any;
      expect(strategy._pkceMethod).toBe('S256');
      expect(strategy._stateStore).toBeInstanceOf(OAuthStateStore);

      const done = jest.fn();
      await strategy.validate(
        { query: { state: 'ESTABELECIMENTO' }, oauthAccountType: 'CLIENTE' },
        'acc-token',
        'ref-token',
        {
          id: 'g-123',
          name: { givenName: 'João', familyName: 'Silva' },
          emails: [{ value: 'joao@gmail.com', verified: true }],
        },
        done,
      );

      expect(done).toHaveBeenCalledWith(null, {
        googleId: 'g-123',
        email: 'joao@gmail.com',
        emailVerified: true,
        name: 'João Silva',
        accountType: 'CLIENTE',
      });
    });
  });
});
