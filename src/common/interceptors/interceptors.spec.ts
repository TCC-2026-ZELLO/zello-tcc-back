import { of, lastValueFrom } from 'rxjs';
import { HttpStatus } from '@nestjs/common';
import { LoggersInterceptor } from './log-interceptor';
import { SucessInterceptor } from './success-interceptor';

describe('Interceptors', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('LoggersInterceptor', () => {
    it('should log before and after handling the request', async () => {
      const interceptor = new LoggersInterceptor();
      const next = { handle: () => of('ok') };

      const obs$ = await interceptor.intercept({} as any, next);
      const result = await lastValueFrom(obs$);

      expect(result).toBe('ok');
      expect(console.log).toHaveBeenCalled();
    });
  });

  describe('SucessInterceptor', () => {
    it('should wrap response with custom message and data when present', async () => {
      const interceptor = new SucessInterceptor();
      const next = {
        handle: () => of({ message: 'Criado!', data: { id: 1 } }),
      };

      const obs$ = await interceptor.intercept({} as any, next);
      const result = await lastValueFrom(obs$);

      expect(result).toEqual({
        status: HttpStatus.OK,
        message: 'Criado!',
        data: { id: 1 },
      });
    });

    it('should wrap plain response with default message', async () => {
      const interceptor = new SucessInterceptor();
      const next = {
        handle: () => of({ id: 2, name: 'Test' }),
      };

      const obs$ = await interceptor.intercept({} as any, next);
      const result = await lastValueFrom(obs$);

      expect(result).toEqual({
        status: HttpStatus.OK,
        message: 'Request successful',
        data: { id: 2, name: 'Test' },
      });
    });
  });
});
