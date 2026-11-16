import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { Injectable } from '@nestjs/common';
import { OAuthStateStore } from './oauth-state.store';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private static getRequiredEnv(name: string): string {
    const value = process.env[name];

    if (!value || value.trim() === '') {
      throw new Error(`Missing required Google OAuth configuration: ${name}`);
    }

    return value;
  }

  constructor() {
    super({
      clientID: GoogleStrategy.getRequiredEnv('GOOGLE_CLIENT_ID'),
      clientSecret: GoogleStrategy.getRequiredEnv('GOOGLE_CLIENT_SECRET'),
      callbackURL: GoogleStrategy.getRequiredEnv('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
      passReqToCallback: true,
      // v5.0.0-10.1.2 / 10.2.1: `state` aleatório vinculado ao navegador e PKCE
      // (S256). A biblioteca sempre envia response_type=code (fluxo
      // Authorization Code); o fluxo implícito não é utilizado.
      state: true,
      pkce: true,
      store: new OAuthStateStore(
        GoogleStrategy.getRequiredEnv('JWT_SECRET'),
      ) as any,
    } as any);
  }

  async validate(
    req: any,
    _accessToken: string,
    _refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { name, emails, id } = profile;
    const primaryEmail = Array.isArray(emails) ? emails[0] : undefined;
    const user = {
      googleId: id,
      email: primaryEmail?.value,
      // O Google informa se o e-mail foi verificado; contas não verificadas
      // não podem ser vinculadas a um cadastro existente.
      emailVerified:
        primaryEmail?.verified === true ||
        profile?._json?.email_verified === true,
      name: [name?.givenName, name?.familyName].filter(Boolean).join(' '),
      // O tipo de conta vem do cookie assinado, nunca do parâmetro `state`
      // devolvido pela URL.
      accountType: req.oauthAccountType ?? undefined,
    };
    // Os tokens do Google não são guardados nem repassados: a aplicação só
    // precisa da identidade.
    done(null, user);
  }
}
