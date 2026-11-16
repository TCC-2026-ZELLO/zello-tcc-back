import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { pathOnly } from './security-event.logger';

type AuditedRequest = Request & {
  user?: { id?: string };
  requestId?: string;
};

/**
 * Log de auditoria de toda requisição (v5.0.0-16.2.1): quem (usuário e IP),
 * quando (UTC, ISO 8601), o quê (método e rota), resultado (status) e latência.
 * A query string e o corpo não são registrados (v5.0.0-16.2.5).
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Audit');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const req = http.getRequest<AuditedRequest>();
    const res = http.getResponse<Response>();
    const startedAt = Date.now();

    req.requestId = req.requestId ?? randomUUID();
    res.setHeader('X-Request-Id', req.requestId);

    const write = (statusCode: number) => {
      const userAgent = req.headers['user-agent'];
      this.logger.log(
        JSON.stringify({
          type: 'http_request',
          timestamp: new Date(startedAt).toISOString(),
          requestId: req.requestId,
          method: req.method,
          path: pathOnly(req.originalUrl),
          statusCode,
          latencyMs: Date.now() - startedAt,
          userId: req.user?.id ?? null,
          ip: req.ip ?? null,
          userAgent:
            typeof userAgent === 'string' ? userAgent.slice(0, 200) : null,
        }),
      );
    };

    return next.handle().pipe(
      tap({
        next: () => write(res.statusCode),
        error: (err: { status?: number; getStatus?: () => number }) =>
          write(
            typeof err?.getStatus === 'function'
              ? err.getStatus()
              : (err?.status ?? 500),
          ),
      }),
    );
  }
}
