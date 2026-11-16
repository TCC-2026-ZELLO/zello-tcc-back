import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { RefreshToken } from '../users/entities/refresh-token.entity';
import { PasswordReset } from '../users/entities/password-reset.entity';
import { LoginAttemptLimiter } from './login-attempt.limiter';
import { JWT_ALGORITHM } from '../../config/security.config';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');

        if (!secret) {
          throw new Error('JWT_SECRET environment variable must be set');
        }

        return {
          secret: secret,
          // v5.0.0-9.1.2: um único algoritmo permitido para assinar e verificar.
          signOptions: { algorithm: JWT_ALGORITHM },
          verifyOptions: { algorithms: [JWT_ALGORITHM] },
        };
      },
    }),
    TypeOrmModule.forFeature([RefreshToken, PasswordReset]),
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const mailHost = configService.get<string>('MAIL_HOST');
        const mailPort = configService.get<string>('MAIL_PORT');
        const mailUser = configService.get<string>('MAIL_USER');
        const mailPass = configService.get<string>('MAIL_PASS');
        const mailSecureStr = configService.get<string>('MAIL_SECURE');
        const mailFrom =
          configService.get<string>('MAIL_FROM') ||
          '"Zello Suporte" <suporte@zello.com>';

        if (!mailHost || !mailPort || !mailUser || !mailPass) {
          throw new Error(
            'MAIL_HOST, MAIL_PORT, MAIL_USER and MAIL_PASS environment variables must be set',
          );
        }

        // Se MAIL_SECURE estiver definido, usa o valor booleano correspondente.
        // Caso contrário, usa secure: true para porta 465 (SMTPS) e false para as demais (STARTTLS).
        const isSecure = mailSecureStr
          ? mailSecureStr === 'true'
          : Number(mailPort) === 465;

        return {
          transport: {
            host: mailHost,
            port: Number(mailPort),
            secure: isSecure,
            auth: {
              user: mailUser,
              pass: mailPass,
            },
          },
          defaults: {
            from: mailFrom,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, GoogleStrategy, LoginAttemptLimiter],
  exports: [AuthService, MailerModule],
})
export class AuthModule {}
