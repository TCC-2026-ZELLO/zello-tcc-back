import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from 'src/modules/users/users.service';
import { AuthService } from '../auth.service';
import {
  cookieNames,
  JWT_ALGORITHM,
  JWT_AUDIENCE_ACCESS,
  JWT_ISSUER,
} from '../../../config/security.config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private usersService: UsersService,
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    const jwtSecret =
      configService.get<string>('JWT_SECRET') || process.env.JWT_SECRET;

    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable must be defined');
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req) => {
          let token = null;
          if (req && req.cookies) {
            token = req.cookies[cookieNames.access()] ?? null;
          }
          return token;
        },
      ]),
      // v5.0.0-9.2.1: `exp` e `nbf` são sempre conferidos.
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
      // v5.0.0-9.1.1 / 9.1.2: assinatura obrigatória e allowlist de algoritmo.
      // Tokens com alg "none" ou qualquer outro algoritmo são recusados.
      algorithms: [JWT_ALGORITHM],
      // v5.0.0-9.2.3 / 9.2.4: emissor e audiência esperados.
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE_ACCESS,
    });
  }

  async validate(payload: any) {
    // v5.0.0-9.2.2: só tokens de acesso autenticam requisições; um refresh
    // token apresentado no lugar do token de acesso é recusado.
    if (!payload || payload.typ !== 'access' || !payload.sub || !payload.sid) {
      throw new UnauthorizedException('Token inválido.');
    }

    let user;

    try {
      user = await this.usersService.findOne(payload.sub);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new UnauthorizedException('Usuário não encontrado.');
      }

      throw error;
    }

    // v5.0.0-7.4.2: conta desativada ou excluída não autentica mais.
    if (!user || user.isActive === false) {
      throw new UnauthorizedException('Usuário não encontrado.');
    }

    // v5.0.0-7.2.1 / 7.4.1: a sessão é validada no backend a cada requisição;
    // logout, troca de senha e encerramento administrativo valem na hora.
    const active = await this.authService.isSessionActive(
      payload.sub,
      payload.sid,
    );
    if (!active) {
      throw new UnauthorizedException('Sessão encerrada.');
    }

    return {
      ...user,
      roles: user.roles?.map((p) => p.name) || [],
      sessionId: payload.sid as string,
    };
  }
}
