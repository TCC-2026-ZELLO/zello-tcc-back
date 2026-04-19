import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { Injectable } from '@nestjs/common';

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
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { name, emails, id } = profile;
    const user = {
      googleId: id,
      email: emails[0].value,
      name: `${name.givenName} ${name.familyName}`,
      accessToken,
    };
    done(null, user);
  }
}
