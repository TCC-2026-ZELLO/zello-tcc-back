import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

@Injectable()
//essa classe é disparada sempre que uma requisição der 200
export class SucessInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler<any>,
  ): Observable<any> | Promise<Observable<any>> {
    console.log('Sua requisição feita com sucesso');
    return next.handle().pipe(
      map((data) => ({
        status: HttpStatus.OK,
        message: 'Request successful',
        data,
      })),
    );
  }
}
