import { ForbiddenException } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { checkPasswordPolicy, PASSWORD_MAX_BYTES } from './password-policy';
import { COMMON_PASSWORDS } from './common-passwords';
import {
  SensitiveDataInterceptor,
  stripSensitiveData,
} from './sensitive-data.interceptor';
import { OriginCheckMiddleware } from './origin-check.middleware';
import { httpMethodAllowlist, noStore } from './http-method.middleware';
import { TenantAccessService } from './tenant-access.service';
import { escapeHtml } from './html-escape';
import { RolesGuard } from '../../modules/auth/guards/roles.guard';
import { validateEnv } from '../../config/env.validation';
import {
  cookieNames,
  getAllowedOrigins,
  sessionCookieOptions,
  trustedProxyHops,
} from '../../config/security.config';

describe('Política de senhas (v5.0.0-6.2.1, 6.2.4, 6.2.5, 6.2.8)', () => {
  it('carrega exatamente 3.000 senhas comuns com 8+ caracteres', () => {
    expect(COMMON_PASSWORDS.size).toBe(3000);
    for (const password of COMMON_PASSWORDS) {
      expect(password.length).toBeGreaterThanOrEqual(8);
    }
  });

  it('exige no mínimo 8 caracteres', () => {
    expect(checkPasswordPolicy('abc1234')).toBe('TOO_SHORT');
    expect(checkPasswordPolicy(undefined)).toBe('TOO_SHORT');
  });

  it('recusa senhas comuns sem diferenciar maiúsculas', () => {
    expect(checkPasswordPolicy('password')).toBe('COMMON_PASSWORD');
    expect(checkPasswordPolicy('PASSWORD')).toBe('COMMON_PASSWORD');
    expect(checkPasswordPolicy('12345678')).toBe('COMMON_PASSWORD');
  });

  it('recusa o nome da plataforma', () => {
    expect(checkPasswordPolicy('Zello2026')).toBe('CONTEXT_WORD');
  });

  it('não impõe composição e aceita Unicode e espaços', () => {
    expect(checkPasswordPolicy('minhasenhacomprida')).toBeNull();
    expect(checkPasswordPolicy('frase com espaços ok')).toBeNull();
    expect(checkPasswordPolicy('çãõéíúñü')).toBeNull();
  });

  it('recusa em vez de truncar senhas acima do limite do bcrypt', () => {
    expect(checkPasswordPolicy('a'.repeat(PASSWORD_MAX_BYTES))).toBeNull();
    expect(checkPasswordPolicy('a'.repeat(PASSWORD_MAX_BYTES + 1))).toBe(
      'TOO_LONG',
    );
  });
});

describe('SensitiveDataInterceptor (v5.0.0-15.3.1)', () => {
  const sample = () => ({
    status: 200,
    data: [
      {
        id: 'a1',
        client: {
          id: 'u1',
          name: 'Ana',
          email: 'ana@zello.com',
          provider: 'local',
          cpf: '12345678901',
          phone: '41999999999',
          passwordHash: 'hash',
          googleId: 'g-1',
          isActive: true,
        },
        business: { id: 'b1', phone: '4133334444' },
      },
    ],
  });

  it('remove credenciais, CPF, telefone pessoal e e-mail de terceiros', () => {
    const result = stripSensitiveData(sample(), { requesterId: 'outro' });
    expect(result.data[0].client).toEqual({
      id: 'u1',
      name: 'Ana',
      provider: 'local',
    });
    // Telefone comercial do estabelecimento é dado público e permanece.
    expect(result.data[0].business.phone).toBe('4133334444');
  });

  it('mantém o e-mail da própria conta e o de rotas autorizadas', () => {
    expect(
      stripSensitiveData(sample(), { requesterId: 'u1' }).data[0].client.email,
    ).toBe('ana@zello.com');
    expect(
      stripSensitiveData(sample(), { keepContactData: true }).data[0].client
        .email,
    ).toBe('ana@zello.com');
    expect(stripSensitiveData(sample()).data[0].client.cpf).toBeUndefined();
  });

  const context = (user?: object) =>
    ({
      getType: () => 'http',
      getHandler: () => null,
      getClass: () => null,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as any;

  it('decide a exposição pelo solicitante e pela marcação da rota', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    const interceptor = new SensitiveDataInterceptor(reflector as any);
    const run = async (user?: object) =>
      (
        (await lastValueFrom(
          interceptor.intercept(context(user), { handle: () => of(sample()) }),
        )) as any
      ).data[0].client.email;

    expect(await run(undefined)).toBeUndefined();
    expect(await run({ id: 'x', roles: ['manager'] })).toBeUndefined();
    expect(await run({ id: 'x', roles: ['admin'] })).toBe('ana@zello.com');
    reflector.getAllAndOverride.mockReturnValue(true);
    expect(await run({ id: 'x', roles: ['manager'] })).toBe('ana@zello.com');
  });

  it('preserva datas e suporta referências circulares', async () => {
    const when = new Date();
    const node: any = { when, passwordHash: 'x' };
    node.self = node;
    const interceptor = new SensitiveDataInterceptor({
      getAllAndOverride: () => undefined,
    } as any);
    const output: any = await lastValueFrom(
      interceptor.intercept(context(), { handle: () => of(node) }),
    );
    expect(output.when).toBe(when);
    expect(output.passwordHash).toBeUndefined();
  });
});

describe('OriginCheckMiddleware (v5.0.0-3.5.1)', () => {
  const events = { log: jest.fn() } as any;
  const middleware = new OriginCheckMiddleware(events);
  const run = (method: string, headers: Record<string, string>) => {
    const next = jest.fn();
    middleware.use({ method, headers } as any, {} as any, next);
    return next;
  };

  it('libera métodos seguros e clientes que não são navegadores', () => {
    expect(
      run('GET', { origin: 'https://atacante.example' }),
    ).toHaveBeenCalled();
    expect(run('POST', {})).toHaveBeenCalled();
  });

  it('aceita origem da allowlist e recusa as demais', () => {
    expect(run('POST', { origin: 'http://localhost:3000' })).toHaveBeenCalled();
    expect(() => run('POST', { origin: 'https://atacante.example' })).toThrow(
      ForbiddenException,
    );
    // Prefixo parecido não é aceito: a comparação é exata.
    expect(() =>
      run('DELETE', { origin: 'http://localhost:3000.atacante.example' }),
    ).toThrow(ForbiddenException);
    expect(events.log).toHaveBeenCalledWith(
      'csrf_origin_rejected',
      expect.anything(),
      expect.anything(),
    );
  });

  it('sem Origin, usa Sec-Fetch-Site', () => {
    expect(run('POST', { 'sec-fetch-site': 'same-origin' })).toHaveBeenCalled();
    expect(() => run('POST', { 'sec-fetch-site': 'cross-site' })).toThrow(
      ForbiddenException,
    );
  });
});

describe('Middlewares HTTP (v5.0.0-3.5.3, 14.3.2)', () => {
  it('recusa métodos fora da allowlist com 405', () => {
    const res: any = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();
    httpMethodAllowlist({ method: 'TRACE' } as any, res, next);
    expect(res.status).toHaveBeenCalledWith(405);
    expect(next).not.toHaveBeenCalled();

    httpMethodAllowlist({ method: 'PATCH' } as any, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('marca as respostas como não armazenáveis em cache', () => {
    const res: any = { setHeader: jest.fn() };
    noStore({} as any, res, jest.fn());
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });
});

describe('TenantAccessService (v5.0.0-8.4.1)', () => {
  const bmRepo = { findOne: jest.fn() } as any;
  const bpRepo = { findOne: jest.fn(), find: jest.fn() } as any;
  const service = new TenantAccessService(bmRepo, bpRepo);

  beforeEach(() => jest.clearAllMocks());

  it('nega acesso a estabelecimento sem vínculo de gestão', async () => {
    bmRepo.findOne.mockResolvedValue(null);
    await expect(
      service.assertManagesBusiness({ id: 'u1', roles: ['manager'] }, 'b2'),
    ).rejects.toThrow(ForbiddenException);
    expect(bmRepo.findOne).toHaveBeenCalledWith({
      where: { business: { id: 'b2' }, manager: { user: { id: 'u1' } } },
    });
  });

  it('libera o gestor do próprio estabelecimento', async () => {
    bmRepo.findOne.mockResolvedValue({ id: 'bm1' });
    await expect(
      service.assertManagesBusiness({ id: 'u1', roles: ['manager'] }, 'b1'),
    ).resolves.toBeUndefined();
  });

  it('admin só passa quando a regra da rota permite', async () => {
    bmRepo.findOne.mockResolvedValue(null);
    const admin = { id: 'adm', roles: ['admin'] };
    await expect(
      service.assertManagesBusiness(admin, 'b1', { allowAdmin: true }),
    ).resolves.toBeUndefined();
    await expect(service.assertManagesBusiness(admin, 'b1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('resolve vínculo de profissional com estabelecimentos geridos', async () => {
    bpRepo.find.mockResolvedValue([{ business: { id: 'b9' } }]);
    bmRepo.findOne.mockResolvedValue(null);
    expect(await service.managesProfessional('u1', 'p1')).toBe(false);
    bmRepo.findOne.mockResolvedValue({ id: 'bm' });
    expect(await service.managesProfessional('u1', 'p1')).toBe(true);
    expect(await service.managesProfessional('', 'p1')).toBe(false);

    bpRepo.findOne.mockResolvedValue({ id: 'bp1' });
    expect(await service.isProfessionalOfLink('u1', 'bp1')).toBe(true);
    expect(await service.isProfessionalOfLink('u1', '')).toBe(false);
    expect(await service.managesBusiness('', 'b1')).toBe(false);
  });
});

describe('RolesGuard (v5.0.0-8.2.1, 8.3.1)', () => {
  const ctx = (user: any) =>
    ({
      getHandler: () => null,
      getClass: () => null,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as any;

  it('falha fechado quando a rota não declara papéis', () => {
    const guard = new RolesGuard({
      getAllAndOverride: () => undefined,
    } as any);
    expect(() => guard.canActivate(ctx({ roles: ['manager'] }))).toThrow(
      ForbiddenException,
    );
  });

  it('exige um dos papéis declarados', () => {
    const guard = new RolesGuard({
      getAllAndOverride: () => ['admin'],
    } as any);
    expect(() => guard.canActivate(ctx({ roles: ['manager'] }))).toThrow(
      ForbiddenException,
    );
    expect(() => guard.canActivate(ctx(undefined))).toThrow(ForbiddenException);
    expect(guard.canActivate(ctx({ roles: ['admin'] }))).toBe(true);
  });
});

describe('Configuração de segurança (v5.0.0-3.3.x, 3.4.2, 4.1.3, 13.3.1)', () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });

  it('em produção só aceita origens HTTPS declaradas, sem curinga', () => {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ALLOWED_ORIGINS =
      'https://app.zello.com.br/, http://inseguro.example, *';
    expect(getAllowedOrigins()).toEqual(['https://app.zello.com.br']);
  });

  it('em produção usa cookies __Host- com Secure, HttpOnly e SameSite=Strict', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.COOKIE_SAMESITE;
    delete process.env.TRUST_PROXY_HOPS;
    expect(cookieNames.access()).toBe('__Host-zello_at');
    expect(cookieNames.refresh()).toBe('__Host-zello_rt');
    expect(sessionCookieOptions(900)).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 900000,
    });
    expect(trustedProxyHops()).toBe(1);
  });

  it('recusa subir em produção com segredo fraco ou configuração insegura', () => {
    const base = {
      NODE_ENV: 'production',
      DB_HOST: 'h',
      DB_USER: 'u',
      DB_PASS: 'p',
      DB_NAME: 'n',
      FRONTEND_BASE_URL: 'https://app.zello.com.br',
    };
    const strong = 'x'.repeat(48);
    expect(() => validateEnv({ ...base, JWT_SECRET: 'curto' })).toThrow(
      /32 bytes/,
    );
    expect(() =>
      validateEnv({ ...base, JWT_SECRET: strong, DB_SYNCHRONIZE: 'true' }),
    ).toThrow(/DB_SYNCHRONIZE/);
    expect(() =>
      validateEnv({ ...base, JWT_SECRET: strong, CORS_ALLOWED_ORIGINS: '*' }),
    ).toThrow(/curinga/);
    expect(() =>
      validateEnv({
        ...base,
        JWT_SECRET: strong,
        FRONTEND_BASE_URL: 'http://app.zello.com.br',
      }),
    ).toThrow(/https/);
    expect(validateEnv({ ...base, JWT_SECRET: strong })).toBeDefined();
    expect(() => validateEnv({ NODE_ENV: 'development' })).toThrow(
      /JWT_SECRET/,
    );
  });
});

describe('escapeHtml (v5.0.0-1.2.1)', () => {
  it('codifica caracteres com significado em HTML', () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe(
      '&lt;img src&#x3D;x onerror&#x3D;&quot;alert(1)&quot;&gt;',
    );
    expect(escapeHtml("O'Brien & Co")).toBe('O&#x27;Brien &amp; Co');
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(42)).toBe('42');
  });
});
