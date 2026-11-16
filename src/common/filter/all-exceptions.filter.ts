import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';
import {
  pathOnly,
  SecurityEventLogger,
} from '../logging/security-event.logger';

/**
 * Filtro global de exceções (v5.0.0-16.5.1).
 *
 * - HttpException: devolve a mensagem de negócio definida pela aplicação.
 * - Erro de banco ou qualquer erro inesperado: devolve mensagem genérica, sem
 *   stack trace, SQL, nomes de tabelas ou caminhos de arquivo. O detalhe fica
 *   apenas no log do servidor, associado ao X-Request-Id.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  constructor(private readonly securityEvents?: SecurityEventLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();
    const path = pathOnly(request.originalUrl ?? request.url);

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();

      if (status === 401) {
        this.securityEvents?.log('authentication_required', request);
      } else if (status === 403) {
        this.securityEvents?.log('authorization_denied', request);
      } else if (status === 429) {
        this.securityEvents?.log('rate_limit_exceeded', request);
      }

      if (status >= 500) {
        this.logger.error(
          `${request.method} ${path} -> ${status}: ${exception.message}`,
          exception.stack,
        );
        response.status(status).json({
          statusCode: status,
          message: 'Erro interno. Tente novamente mais tarde.',
          requestId: request.requestId ?? null,
        });
        return;
      }

      response
        .status(status)
        .json(
          typeof body === 'string'
            ? { statusCode: status, message: body }
            : body,
        );
      return;
    }

    if (
      exception instanceof QueryFailedError &&
      (exception as QueryFailedError & { code?: string }).code === '23505'
    ) {
      response.status(HttpStatus.CONFLICT).json({
        statusCode: HttpStatus.CONFLICT,
        message: 'Os dados informados já existem no sistema.',
        error: 'Conflict',
      });
      return;
    }

    const error = exception instanceof Error ? exception : undefined;
    this.logger.error(
      `${request.method} ${path} -> 500 (requestId=${request.requestId ?? '-'}): ${error?.name ?? 'Erro desconhecido'}: ${error?.message ?? ''}`,
      error?.stack,
    );
    this.securityEvents?.log('unexpected_error', request, {
      errorName: error?.name ?? 'unknown',
    });

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Erro interno. Tente novamente mais tarde.',
      requestId: request.requestId ?? null,
    });
  }
}
