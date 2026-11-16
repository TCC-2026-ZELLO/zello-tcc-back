import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { BusinessesModule } from './modules/businesses/businesses.module';
import { ManagersModule } from './modules/profiles/managers/managers.module';
import { ProfessionalsModule } from './modules/profiles/professionals/professionals.module';
import { ClientsModule } from './modules/profiles/clients/clients.module';
import { SearchModule } from './modules/search/search.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { AvailabilityModule } from './modules/availability/availability.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { MediaModule } from './modules/media/media.module';
import { BusinessProfessionalsModule } from './modules/business-professionals/business-professionals.module';
import { BusinessManagersModule } from './modules/business-managers/business-managers.module';
import { FilesModule } from './modules/files/files.module';
import { FilesService } from './modules/files/files.service';
import { AddressesModule } from './modules/addresses/addresses.module';
import { ServicesLocationModule } from './modules/services-location/services-location.module';
import { LookupController } from './common/controllers/lookup.controller';
import { ViaCepService } from './common/services/viacep.service';
import { CnpjLookupService } from './common/services/cnpj-lookup.service';
import { CombosModule } from './modules/combos/combos.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { SecurityModule } from './common/security/security.module';
import { OriginCheckMiddleware } from './common/security/origin-check.middleware';
import { SensitiveDataInterceptor } from './common/security/sensitive-data.interceptor';
import { AuditLogInterceptor } from './common/logging/audit-log.interceptor';
import { validateEnv } from './config/env.validation';
import { rateLimitConfig } from './config/security.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // v5.0.0-13.3.1: a aplicação não sobe com segredo ausente ou fraco.
      validate: validateEnv,
    }),
    ScheduleModule.forRoot(),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isProd = configService.get<string>('NODE_ENV') === 'production';
        const sslEnabled = configService.get<string>('DB_SSL') === 'true';
        const sslCa = configService.get<string>('DB_SSL_CA');
        // A validação do certificado do banco fica sempre ligada em produção.
        const rejectUnauthorized =
          isProd ||
          configService.get<string>('DB_SSL_REJECT_UNAUTHORIZED') !== 'false';
        // O schema nunca é alterado automaticamente em produção: as mudanças
        // entram por migrations versionadas (src/migrations).
        const synchronize =
          !isProd && configService.get<string>('DB_SYNCHRONIZE') !== 'false';
        const migrationsRun =
          configService.get<string>('DB_MIGRATIONS_RUN') !== undefined
            ? configService.get<string>('DB_MIGRATIONS_RUN') === 'true'
            : isProd;

        return {
        type: 'postgres' as const,
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USER'),
        password: configService.get<string>('DB_PASS'),
        database: configService.get<string>('DB_NAME'),

        autoLoadEntities: true,
        synchronize,
        dropSchema: false,
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        migrationsRun,
        ssl: sslEnabled
          ? { rejectUnauthorized, ...(sslCa ? { ca: sslCa } : {}) }
          : false,
        };
      },
    }),

    // v5.0.0-6.3.1 / 2.4.1: limite global por IP. As rotas de autenticação
    // têm limites próprios, mais baixos, declarados com @Throttle.
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: rateLimitConfig.globalPerMinute(),
      },
    ]),

    SecurityModule,

    UsersModule,
    AuthModule,
    BusinessesModule,
    ClientsModule,
    ProfessionalsModule,
    ManagersModule,
    SearchModule,
    CatalogModule,
    AvailabilityModule,
    AppointmentsModule,
    ReviewsModule,
    MediaModule,
    BusinessProfessionalsModule,
    BusinessManagersModule,
    FilesModule,
    AddressesModule,
    ServicesLocationModule,
    CombosModule,
    DashboardModule,
  ],
  controllers: [AppController, LookupController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // v5.0.0-16.2.1: log de auditoria de todas as requisições.
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
    // v5.0.0-15.3.1: nenhum dado sensível sai em respostas.
    {
      provide: APP_INTERCEPTOR,
      useClass: SensitiveDataInterceptor,
    },
    FilesService,
    ViaCepService,
    CnpjLookupService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // v5.0.0-3.5.1: verificação de origem em toda requisição que altera estado.
    consumer.apply(OriginCheckMiddleware).forRoutes('*');
  }
}
