import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DatabaseExceptionFilter } from './common/filter/database-exception.filter';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import dns from 'node:dns';

dns.setDefaultResultOrder('ipv4first');

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const config = new DocumentBuilder()
    .setTitle('ZELLO API — Plataforma de Gestão e Agendamento de Serviços')
    .setDescription(
      'Documentação OpenAPI 3.0 completa dos serviços de backend da plataforma **Zello**.\n\n' +
        'A API gerencia autenticação (JWT, Cookies HTTP-Only e Google OAuth 2.0), perfis de usuários (Clientes, Profissionais, Gestores e Administradores), estabelecimentos, catálogo de serviços, pacotes promocionais (combos) com disponibilidade sincronizada, agendamentos com controle de reputação/no-show, avaliações e busca geolocalizada via PostGIS.',
    )
    .setVersion('1.0.0')
    .addServer('http://localhost:3001', 'Servidor Local de Desenvolvimento')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Informe o token JWT de acesso (Bearer Token)',
      },
      'bearer',
    )
    .addCookieAuth('access_token', {
      type: 'apiKey',
      in: 'cookie',
      name: 'access_token',
      description: 'Cookie HTTP-Only contendo o JWT de acesso',
    })
    .addTag('health', 'Verificação de disponibilidade e status da API')
    .addTag(
      'auth',
      'Autenticação de usuários, sessão JWT/Cookies, Google OAuth 2.0 e recuperação de senha',
    )
    .addTag('users', 'Cadastro, gerenciamento de contas e vinculação de perfis')
    .addTag(
      'businesses',
      'Gestão de estabelecimentos, perfil comercial e galeria de fotos',
    )
    .addTag(
      'business-administration',
      'Vínculos de gestores com estabelecimentos',
    )
    .addTag(
      'business-management',
      'Vínculos de profissionais, serviços habilitados e turnos por estabelecimento',
    )
    .addTag(
      'catalog',
      'Catálogo de serviços oferecidos pelos estabelecimentos',
    )
    .addTag(
      'combos',
      'Pacotes promocionais de serviços combinados e disponibilidade sincronizada',
    )
    .addTag(
      'combo-bookings',
      'Solicitações, aprovações e cancelamentos de reservas de combos',
    )
    .addTag(
      'availability',
      'Horários de funcionamento, turnos de profissionais, exceções de agenda e slots livres',
    )
    .addTag(
      'appointments',
      'Agendamentos de serviços, remarcações, propostas de horário e reputação (No-Show)',
    )
    .addTag(
      'reviews',
      'Avaliações de atendimentos por clientes e respostas de profissionais/gestores',
    )
    .addTag(
      'search',
      'Busca textual e filtrada de profissionais e estabelecimentos',
    )
    .addTag(
      'services',
      'Busca geolocalizada de estabelecimentos e serviços num raio de 10km (PostGIS)',
    )
    .addTag(
      'professionals',
      'Perfis públicos e privados de profissionais, portfólio e qualificações (certificados)',
    )
    .addTag('clients', 'Gerenciamento de perfis de clientes e indicadores')
    .addTag('managers', 'Gerenciamento de perfis de gestores')
    .addTag(
      'lookup',
      'Consultas externas auxiliares de CEP (ViaCEP) e CNPJ (ReceitaWS)',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api-json', app, document);

  app.use(
    '/docs',
    apiReference({
      theme: 'purple',
      url: '/api-json-json',
    }),
  );

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new DatabaseExceptionFilter());
  app.use(
    helmet({
      crossOriginResourcePolicy: false,
    }),
  );

  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  const allowedOrigins = (
    process.env.CORS_ALLOWED_ORIGINS ??
    'http://localhost:5173,http://localhost:3000,http://localhost:4000,http://localhost:3001'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  app.enableCors({
    origin: (origin, callback) => {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        origin.startsWith('http://localhost') ||
        origin.startsWith('http://127.0.0.1')
      ) {
        return callback(null, true);
      }

      return callback(new Error(`Not allowed by CORS: ${origin}`), false);
    },
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
