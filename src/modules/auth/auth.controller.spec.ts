import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RolesGuard } from './guards/roles.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';

describe('AuthController, Guards & Strategies', () => {
  describe('AuthController', () => {
    let controller: AuthController;
    let authService: any;
    let mockRes: any;

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
      controller = new AuthController(authService as AuthService);
      mockRes = {
        cookie: jest.fn(),
        clearCookie: jest.fn(),
        redirect: jest.fn().mockReturnValue('redirected'),
      };
    });

    it('should login and set cookies', async () => {
      authService.validateUser.mockResolvedValue({ id: 'u1' });
      authService.login.mockResolvedValue({
        access_token: 'at',
        refresh_token: 'rt',
        user: { id: 'u1', email: 'a@b.com' },
      });

      const res = await controller.login(
        { email: 'a@b.com', password: '123' },
        mockRes,
      );

      expect(mockRes.cookie).toHaveBeenCalledTimes(2);
      expect(res).toEqual({ user: { id: 'u1', email: 'a@b.com' } });
    });

    it('should logout and clear cookies', async () => {
      const res = await controller.logout({ user: { id: 'u1' } }, mockRes);
      expect(mockRes.clearCookie).toHaveBeenCalledTimes(2);
      expect(authService.logout).toHaveBeenCalledWith('u1');
      expect(res).toEqual({ message: 'Logged out successfully' });
    });

    it('should return profile in getProfile', () => {
      expect(controller.getProfile({ user: { id: 'u1' } })).toEqual({
        user: { id: 'u1' },
      });
    });

    it('should throw UnauthorizedException when refresh_token cookie is missing', async () => {
      await expect(controller.refresh({ cookies: {} }, mockRes)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should refresh tokens and set cookies when cookie exists', async () => {
      authService.refresh.mockResolvedValue({
        access_token: 'at2',
        refresh_token: 'rt2',
        user: { id: 'u1' },
      });

      const res = await controller.refresh(
        { cookies: { refresh_token: 'rt1' } },
        mockRes,
      );
      expect(mockRes.cookie).toHaveBeenCalledTimes(2);
      expect(res).toEqual({ user: { id: 'u1' } });
    });

    it('should execute googleAuth placeholder', async () => {
      await expect(controller.googleAuth({})).resolves.toBeUndefined();
    });

    it('should redirect on googleAuthRedirect using GOOGLE_REDIRECT_URL', async () => {
      process.env.GOOGLE_REDIRECT_URL = 'http://localhost:5173/explore';
      authService.validateGoogleUser.mockResolvedValue({
        access_token: 'at',
        refresh_token: 'rt',
      });

      await controller.googleAuthRedirect({ user: {} }, mockRes);
      expect(mockRes.redirect).toHaveBeenCalledWith(
        'http://localhost:5173/explore',
      );
      delete process.env.GOOGLE_REDIRECT_URL;
    });

    it('should redirect on googleAuthRedirect using FRONTEND_BASE_URL fallback', async () => {
      delete process.env.GOOGLE_REDIRECT_URL;
      process.env.FRONTEND_BASE_URL = 'http://localhost:5173';
      authService.validateGoogleUser.mockResolvedValue({
        access_token: 'at',
        refresh_token: 'rt',
      });

      await controller.googleAuthRedirect({ user: {} }, mockRes);
      expect(mockRes.redirect).toHaveBeenCalledWith(
        'http://localhost:5173/explore',
      );
    });

    it('should throw error if no redirect URL is configured in googleAuthRedirect', async () => {
      delete process.env.GOOGLE_REDIRECT_URL;
      delete process.env.FRONTEND_BASE_URL;
      authService.validateGoogleUser.mockResolvedValue({
        access_token: 'at',
        refresh_token: 'rt',
      });

      await expect(
        controller.googleAuthRedirect({ user: {} }, mockRes),
      ).rejects.toThrow('Missing redirect URL configuration');
    });

    it('should throw error if redirect URL has invalid protocol', async () => {
      process.env.GOOGLE_REDIRECT_URL = 'javascript:alert(1)';
      authService.validateGoogleUser.mockResolvedValue({
        access_token: 'at',
        refresh_token: 'rt',
      });

      await expect(
        controller.googleAuthRedirect({ user: {} }, mockRes),
      ).rejects.toThrow('Invalid redirect URL protocol.');
      delete process.env.GOOGLE_REDIRECT_URL;
    });

    it('should delegate forgotPassword and resetPassword', async () => {
      authService.forgotPassword.mockResolvedValue({ message: 'ok' });
      authService.resetPassword.mockResolvedValue({ message: 'reset' });

      expect(
        await controller.forgotPassword({ email: 'a@b.com' }),
      ).toEqual({ message: 'ok' });
      expect(
        await controller.resetPassword({ token: 't', newPassword: 'P@1' }),
      ).toEqual({ message: 'reset' });
    });
  });

  describe('RolesGuard & GoogleAuthGuard', () => {
    it('RolesGuard should allow when no requiredRoles are defined', () => {
      const reflector = {
        getAllAndOverride: jest.fn().mockReturnValue(undefined),
      } as unknown as Reflector;
      const guard = new RolesGuard(reflector);
      const ctx: any = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
      };
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('RolesGuard should allow when user has required role and throw ForbiddenException otherwise', () => {
      const reflector = {
        getAllAndOverride: jest.fn().mockReturnValue(['admin']),
      } as unknown as Reflector;
      const guard = new RolesGuard(reflector);

      const allowedCtx: any = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: () => ({
          getRequest: () => ({ user: { roles: ['admin'] } }),
        }),
      };
      expect(guard.canActivate(allowedCtx)).toBe(true);

      const deniedCtx: any = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: () => ({
          getRequest: () => ({ user: { roles: ['client'] } }),
        }),
      };
      expect(() => guard.canActivate(deniedCtx)).toThrow(ForbiddenException);
    });

    it('GoogleAuthGuard should build authenticate options from query role or empty', () => {
      const guard = new GoogleAuthGuard();
      const ctxWithRole: any = {
        switchToHttp: () => ({
          getRequest: () => ({ query: { role: 'PROFISSIONAL' } }),
        }),
      };
      expect(guard.getAuthenticateOptions(ctxWithRole)).toEqual({
        state: 'PROFISSIONAL',
      });

      const ctxEmpty: any = {
        switchToHttp: () => ({
          getRequest: () => ({ query: {} }),
        }),
      };
      expect(guard.getAuthenticateOptions(ctxEmpty)).toEqual({});
    });
  });

  describe('JwtStrategy & GoogleStrategy', () => {
    it('JwtStrategy should throw if JWT_SECRET is missing', () => {
      const prev = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;
      const configService: any = { get: jest.fn().mockReturnValue(undefined) };

      expect(() => new JwtStrategy({} as any, configService)).toThrow(
        'JWT_SECRET environment variable must be defined',
      );
      process.env.JWT_SECRET = prev;
    });

    it('JwtStrategy should validate user, map roles, and extract cookie token', async () => {
      const usersService: any = {
        findOne: jest.fn().mockResolvedValue({
          id: 'u1',
          roles: [{ name: 'manager' }],
        }),
      };
      const configService: any = { get: jest.fn().mockReturnValue('secret') };
      const strategy = new JwtStrategy(usersService, configService) as any;

      const validated = await strategy.validate({ sub: 'u1' });
      expect(validated.roles).toEqual(['manager']);

      usersService.findOne.mockResolvedValue({ id: 'u2' });
      const validatedNoRoles = await strategy.validate({ sub: 'u2' });
      expect(validatedNoRoles.roles).toEqual([]);

      if (strategy._jwtFromRequest) {
        expect(
          strategy._jwtFromRequest({
            headers: {},
            cookies: { access_token: 'cookie-jwt' },
          }),
        ).toBe('cookie-jwt');
        expect(strategy._jwtFromRequest({ headers: {} })).toBeNull();
      }
    });

    it('JwtStrategy should throw UnauthorizedException when user not found or rethrow unexpected error', async () => {
      const usersService: any = {
        findOne: jest.fn().mockRejectedValue(new NotFoundException()),
      };
      const configService: any = { get: jest.fn().mockReturnValue('secret') };
      const strategy = new JwtStrategy(usersService, configService);

      await expect(strategy.validate({ sub: 'u1' })).rejects.toThrow(
        UnauthorizedException,
      );

      usersService.findOne.mockRejectedValue(new Error('DB crash'));
      await expect(strategy.validate({ sub: 'u1' })).rejects.toThrow('DB crash');

      usersService.findOne.mockResolvedValue(null);
      await expect(strategy.validate({ sub: 'u1' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('GoogleStrategy should validate profile and call done callback', async () => {
      process.env.GOOGLE_CLIENT_ID = 'cid';
      process.env.GOOGLE_CLIENT_SECRET = 'csec';
      process.env.GOOGLE_CALLBACK_URL = 'http://localhost/cb';

      const strategy = new GoogleStrategy();
      const done = jest.fn();

      await strategy.validate(
        { query: { state: 'CLIENTE' } },
        'acc-token',
        'ref-token',
        {
          id: 'g-123',
          name: { givenName: 'João', familyName: 'Silva' },
          emails: [{ value: 'joao@gmail.com' }],
        },
        done,
      );

      expect(done).toHaveBeenCalledWith(null, {
        googleId: 'g-123',
        email: 'joao@gmail.com',
        name: 'João Silva',
        accessToken: 'acc-token',
        accountType: 'CLIENTE',
      });
    });
  });
});
