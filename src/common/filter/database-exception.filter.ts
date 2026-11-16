import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

/**
 * Filtro específico de erros de banco (v5.0.0-16.5.1). O filtro global
 * AllExceptionsFilter cobre os demais erros; este permanece para uso isolado.
 * Nenhuma resposta carrega a mensagem do driver, SQL ou stack trace, em
 * nenhum ambiente.
 */
@Catch(QueryFailedError)
export class DatabaseExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DatabaseExceptionFilter.name);

  catch(exception: QueryFailedError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const path = (request.url ?? '').split('?')[0];

    if ((exception as any).code === '23505') {
      return response.status(HttpStatus.CONFLICT).json({
        statusCode: HttpStatus.CONFLICT,
        message:
          'Os dados informados já existem no sistema. (Ex: e-mail já cadastrado)',
        error: 'Conflict',
        path,
      });
    }

    this.logger.error(
      `Erro de banco em ${request.method} ${path}: ${exception.message}`,
      exception.stack,
    );

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Erro interno no banco de dados.',
      path,
    });
  }
}
