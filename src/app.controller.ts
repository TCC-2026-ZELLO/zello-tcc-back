import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({
    summary: 'Verificar disponibilidade da API (Health Check)',
    description:
      'Endpoint público raiz para verificar se o servidor backend da plataforma Zello está em execução e respondendo corretamente.',
  })
  @ApiResponse({
    status: 200,
    description: 'Servidor ativo e respondendo.',
    schema: {
      type: 'string',
      example: 'Hello World!',
    },
  })
  getHello(): string {
    return this.appService.getHello();
  }
}
