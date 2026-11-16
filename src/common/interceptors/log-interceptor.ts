import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';

/**
 * Mantido por compatibilidade com os controllers que já o declaram.
 *
 * O registro de requisições (URL, usuário, status e latência) é feito de forma
 * centralizada e estruturada pelo AuditLogInterceptor global
 * (src/common/logging/audit-log.interceptor.ts). Este interceptor não escreve
 * mais no console, para não gerar linhas sem contexto nem duplicadas.
 */
@Injectable()
export class LoggersInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<any>,
  ): Observable<any> | Promise<Observable<any>> {
    return next.handle();
  }
}
