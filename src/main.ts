import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from './common/filter/all-exceptions.filter';
import { SecurityEventLogger } from './common/logging/security-event.logger';
import {
  httpMethodAllowlist,
  noStore,
} from './common/security/http-method.middleware';
import {
  getAllowedOrigins,
  isProduction,
  trustedProxyHops,
} from './config/security.config';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import dns from 'node:dns';

dns.setDefaultResultOrder('ipv4first');

/** Limite do corpo de requisições JSON e de formulário (v5.0.0-4.2.1 / 2.2.1). */
const BODY_LIMIT = '100kb';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // O parser padrão é substituído abaixo por um com limite explícito.
    bodyParser: false,
  });
  const logger = new Logger('Bootstrap');

  // v5.0.0-4.1.3: só os proxies de infraestrutura (ingress do Azure e nginx do
  // frontend) são confiáveis para informar o IP do cliente. Com a contagem de
  // saltos, valores de X-Forwarded-For forjados pelo cliente são descartados.
  app.set('trust proxy', trustedProxyHops());
  app.disable('x-powered-by');

  app.use(httpMethodAllowlist);

  // v5.0.0-13.4.5: a documentação da API (Swagger e Scalar) não existe em
  // produção. Em desenvolvimento ela é registrada antes do helmet porque a
  // interface do Scalar carrega recursos de CDN incompatíveis com a CSP da API.
  if (!isProduction()) {
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
  } else {
    logger.log('Documentação da API desativada (NODE_ENV=production).');
  }

  // v5.0.0-3.4.1, 3.4.3 a 3.4.6: cabeçalhos de segurança em todas as respostas.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          // A API só devolve JSON: nenhuma origem de script, estilo ou mídia.
          defaultSrc: ["'none'"],
          baseUri: ["'none'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          formAction: ["'none'"],
        },
      },
      strictTransportSecurity: {
        maxAge: 31536000, // 1 ano
        includeSubDomains: true,
      },
      referrerPolicy: { policy: 'no-referrer' },
      frameguard: { action: 'deny' },
      crossOriginResourcePolicy: { policy: 'same-site' },
      crossOriginOpenerPolicy: { policy: 'same-origin' },
    }),
  );
  app.use(noStore);

  app.use(cookieParser());
  app.use(json({ limit: BODY_LIMIT }));
  app.use(urlencoded({ extended: false, limit: BODY_LIMIT }));

  // v5.0.0-2.2.1, 2.2.2, 15.3.3: toda entrada é validada no backend contra o
  // DTO da rota. Campos não declarados fazem a requisição ser recusada.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transform: true,
    }),
  );

  // v5.0.0-16.5.1: mensagens genéricas para erros inesperados.
  app.useGlobalFilters(new AllExceptionsFilter(app.get(SecurityEventLogger)));

  // Arquivos locais de desenvolvimento. Em produção os uploads ficam no
  // armazenamento de objetos e a API não serve arquivos estáticos
  // (v5.0.0-5.3.1 / 13.4.7).
  if (!isProduction()) {
    app.useStaticAssets(join(process.cwd(), 'uploads'), {
      prefix: '/uploads/',
      dotfiles: 'deny',
      index: false,
      setHeaders: (res, filePath) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
        if (!/\.(jpe?g|png|webp|pdf)$/i.test(filePath)) {
          res.statusCode = 404;
        }
      },
    });
  }

  // v5.0.0-3.4.2 / 3.5.2: CORS com allowlist exata. Não há curinga nem
  // comparação por prefixo; origem fora da lista não recebe os cabeçalhos
  // Access-Control-Allow-*.
  const allowedOrigins = getAllowedOrigins();
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Language'],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 600,
  });

  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
