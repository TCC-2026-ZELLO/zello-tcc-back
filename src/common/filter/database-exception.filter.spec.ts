import { HttpStatus } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { DatabaseExceptionFilter } from './database-exception.filter';

describe('DatabaseExceptionFilter', () => {
  let filter: DatabaseExceptionFilter;
  let mockResponse: any;
  let mockRequest: any;
  let mockHost: any;

  beforeEach(() => {
    filter = new DatabaseExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockRequest = { url: '/test-url' };
    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    };
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return 409 Conflict when postgres unique violation code 23505 occurs', () => {
    const exception: any = new QueryFailedError('SELECT 1', [], new Error('dup'));
    exception.code = '23505';

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.CONFLICT,
      message:
        'Os dados informados já existem no sistema. (Ex: e-mail já cadastrado)',
      error: 'Conflict',
      path: '/test-url',
    });
  });

  it('should return 500 with errorDump when NODE_ENV is not production', () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const exception = new QueryFailedError(
      'SELECT 1',
      [],
      new Error('db failure'),
    );

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Erro interno no banco de dados.',
      path: '/test-url',
      errorDump: exception.message,
    });

    process.env.NODE_ENV = prevEnv;
  });

  it('should return 500 without errorDump when NODE_ENV is production', () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const exception = new QueryFailedError(
      'SELECT 1',
      [],
      new Error('db failure'),
    );

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Erro interno no banco de dados.',
      path: '/test-url',
    });

    process.env.NODE_ENV = prevEnv;
  });
});
