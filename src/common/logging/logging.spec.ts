import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
} from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { QueryFailedError } from 'typeorm';
import { AuditLogInterceptor } from './audit-log.interceptor';
import { pathOnly, redact, SecurityEventLogger } from './security-event.logger';
import { AllExceptionsFilter } from '../filter/all-exceptions.filter';

describe('Logs de segurança (v5.0.0-16.2.1, 16.2.5, 16.3.1)', () => {
  it('nunca grava senhas, tokens, cookies ou CPF', () => {
    expect(
      redact({
        email: 'a@b.com',
        password: 'segredo',
        newPassword: 'outro',
        refresh_token: 'jwt',
        nested: { Authorization: 'Bearer x', cpf: '123', ok: 1 },
        list: [{ token: 't' }],
      }),
    ).toEqual({
      email: 'a@b.com',
      password: '[removido]',
      newPassword: '[removido]',
      refresh_token: '[removido]',
      nested: { Authorization: '[removido]', cpf: '[removido]', ok: 1 },
      list: [{ token: '[removido]' }],
    });
  });

  it('descarta a query string do caminho registrado', () => {
    expect(pathOnly('/auth/reset?token=abc')).toBe('/auth/reset');
    expect(pathOnly(undefined)).toBe('');
  });

  it('emite evento estruturado com horário UTC, usuário, IP e rota', () => {
    const logger = new SecurityEventLogger();
    const warn = jest
      .spyOn((logger as any).logger, 'warn')
      .mockImplementation(() => undefined);
    logger.log(
      'login_failure',
      {
        method: 'POST',
        originalUrl: '/auth/login?x=1',
        ip: '203.0.113.7',
        headers: {},
      } as any,
      { password: 'nao-pode-aparecer' },
    );
    const entry = JSON.parse(warn.mock.calls[0][0] as string);
    expect(entry).toMatchObject({
      type: 'security_event',
      event: 'login_failure',
      ip: '203.0.113.7',
      method: 'POST',
      path: '/auth/login',
      details: { password: '[removido]' },
    });
    expect(entry.timestamp).toMatch(/Z$/);
  });
});

describe('AuditLogInterceptor (v5.0.0-16.2.1)', () => {
  const makeContext = (req: any, res: any) =>
    ({
      getType: () => 'http',
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    }) as any;

  it('registra quem, quando, o quê, status e latência, sem query string', async () => {
    const interceptor = new AuditLogInterceptor();
    const log = jest
      .spyOn((interceptor as any).logger, 'log')
      .mockImplementation(() => undefined);
    const req: any = {
      method: 'GET',
      originalUrl: '/dashboard/businesses/b1?from=2026-01-01',
      ip: '198.51.100.4',
      headers: { 'user-agent': 'jest' },
      user: { id: 'u1' },
    };
    const res: any = { statusCode: 200, setHeader: jest.fn() };

    await lastValueFrom(
      interceptor.intercept(makeContext(req, res), { handle: () => of('ok') }),
    );

    const entry = JSON.parse(log.mock.calls[0][0] as string);
    expect(entry).toMatchObject({
      type: 'http_request',
      method: 'GET',
      path: '/dashboard/businesses/b1',
      statusCode: 200,
      userId: 'u1',
      ip: '198.51.100.4',
    });
    expect(typeof entry.latencyMs).toBe('number');
    expect(entry.timestamp).toMatch(/Z$/);
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', req.requestId);
  });

  it('registra o status também quando a requisição falha', async () => {
    const interceptor = new AuditLogInterceptor();
    const log = jest
      .spyOn((interceptor as any).logger, 'log')
      .mockImplementation(() => undefined);
    const req: any = { method: 'POST', originalUrl: '/x', headers: {} };
    const res: any = { statusCode: 200, setHeader: jest.fn() };
    await expect(
      lastValueFrom(
        interceptor.intercept(makeContext(req, res), {
          handle: () => throwError(() => new ForbiddenException()),
        }),
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(JSON.parse(log.mock.calls[0][0] as string).statusCode).toBe(403);
  });
});

describe('AllExceptionsFilter (v5.0.0-16.5.1)', () => {
  const events = { log: jest.fn() } as any;
  const filter = new AllExceptionsFilter(events);
  jest
    .spyOn((filter as any).logger, 'error')
    .mockImplementation(() => undefined);

  const run = (exception: unknown) => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    filter.catch(exception, {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({
          method: 'GET',
          originalUrl: '/users/1?debug=1',
          requestId: 'req-1',
        }),
      }),
    } as any);
    return { status: status.mock.calls[0][0], body: json.mock.calls[0][0] };
  };

  beforeEach(() => events.log.mockClear());

  it('devolve mensagem genérica, sem SQL nem stack, para erro de banco', () => {
    const { status, body } = run(
      new QueryFailedError(
        'SELECT * FROM "user" WHERE cpf = $1',
        ['123'],
        new Error('relation "user" does not exist'),
      ),
    );
    expect(status).toBe(500);
    expect(body).toEqual({
      statusCode: 500,
      message: 'Erro interno. Tente novamente mais tarde.',
      requestId: 'req-1',
    });
    expect(JSON.stringify(body)).not.toMatch(/SELECT|relation|stack/i);
    expect(events.log).toHaveBeenCalledWith(
      'unexpected_error',
      expect.anything(),
      expect.anything(),
    );
  });

  it('devolve mensagem genérica para erro inesperado e para 5xx explícito', () => {
    expect(
      run(new TypeError('Cannot read properties of undefined')).body.message,
    ).toBe('Erro interno. Tente novamente mais tarde.');
    expect(
      run(new InternalServerErrorException('detalhe interno')).body.message,
    ).toBe('Erro interno. Tente novamente mais tarde.');
  });

  it('mantém a mensagem de negócio de erros 4xx e registra 401, 403 e 429', () => {
    expect(run(new BadRequestException('Campo inválido.')).body.message).toBe(
      'Campo inválido.',
    );
    run(new ForbiddenException());
    expect(events.log).toHaveBeenCalledWith(
      'authorization_denied',
      expect.anything(),
    );
    run(new HttpException('Muitas requisições', 429));
    expect(events.log).toHaveBeenCalledWith(
      'rate_limit_exceeded',
      expect.anything(),
    );
    expect(run(new HttpException('texto', 418)).body).toEqual({
      statusCode: 418,
      message: 'texto',
    });
  });

  it('mapeia violação de unicidade para 409 sem expor o nome da constraint', () => {
    const error: any = new QueryFailedError('INSERT', [], new Error('dup'));
    error.code = '23505';
    const { status, body } = run(error);
    expect(status).toBe(409);
    expect(JSON.stringify(body)).not.toMatch(/INSERT|dup/);
  });
});
