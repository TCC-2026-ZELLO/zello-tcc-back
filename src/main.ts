import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DatabaseExceptionFilter } from './common/filter/database-exception.filter';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new DatabaseExceptionFilter());
  app.use(helmet());

  const allowedOrigins = (
    process.env.CORS_ALLOWED_ORIGINS ??
    'http://localhost:5173,http://localhost:3000'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
