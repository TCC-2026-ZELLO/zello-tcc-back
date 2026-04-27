import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

@Catch(QueryFailedError)
export class DatabaseExceptionFilter implements ExceptionFilter {
  catch(exception: QueryFailedError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if ((exception as any).code === '23505') {
      return response.status(HttpStatus.CONFLICT).json({
        statusCode: HttpStatus.CONFLICT,
        message:
          'Os dados informados já existem no sistema. (Ex: e-mail já cadastrado)',
        error: 'Conflict',
        path: request.url,
      });
    }

    console.error('DatabaseExceptionFilter:', {
      message: exception.message,
      stack: exception.stack,
      path: request.url,
    });

    const errorResponse: {
      statusCode: number;
      message: string;
      path: string;
      errorDump?: string;
    } = {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Erro interno no banco de dados.',
      path: request.url,
    };

    if (process.env.NODE_ENV !== 'production') {
      errorResponse.errorDump = exception.message;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse);
  }
}
