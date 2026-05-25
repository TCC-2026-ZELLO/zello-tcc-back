import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { APP_GUARD } from '@nestjs/core';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USER'),
        password: configService.get<string>('DB_PASS'),
        database: configService.get<string>('DB_NAME'),

        autoLoadEntities: true,
        synchronize: true, // desativar quando em produção
        dropSchema: false, // ativar quando mudanças nas entidades quebrar migração
      }),
    }),

    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 9999999,
      },
    ]),

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
    BusinessProfessionalsModule,
    BusinessManagersModule,
    FilesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    FilesService,
  ],
})
export class AppModule {}
