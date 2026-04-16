import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { AuthProvider } from '../users/entities/user.entity';
import { RefreshToken } from '../users/entities/refresh-token.entity';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private dataSource: DataSource,
    private usersService: UsersService,
    @InjectRepository(RefreshToken)
    private refreshTokenRepo: Repository<RefreshToken>,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findByEmailWithPassword(email);

    if (!user) {
      throw new UnauthorizedException('E-mail ou senha incorretos.');
    }

    if (user.provider === AuthProvider.GOOGLE) {
      throw new UnauthorizedException(
        'Esta conta está vinculada ao Google. Use o botão "Entrar com Google".',
      );
    }

    const isMatch = await bcrypt.compare(pass, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('E-mail ou senha incorretos.');
    }

    const { passwordHash, ...result } = user;
    return result;
  }

  async generateTokens(user: any) {
    const accessPayload = {
      sub: user.id,
      email: user.email,
      roles: user.roles?.map((p: any) => p.name) || [],
    };
    const accessToken = this.jwtService.sign(accessPayload, {
      expiresIn: '1h',
    });

    const tokenId = randomUUID();
    const refreshPayload = { sub: user.id, tokenId };
    const refreshToken = this.jwtService.sign(refreshPayload, {
      expiresIn: '7d',
    });

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.refreshTokenRepo.save({
      tokenId,
      user: { id: user.id },
      expiresAt,
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: { id: user.id, name: user.name, email: user.email },
    };
  }

  async refresh(refreshToken: string) {
    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken);
    } catch (err) {
      throw new UnauthorizedException(
        err.name === 'TokenExpiredError'
          ? 'Sessão expirada. Faça login novamente.'
          : 'Refresh token inválido.',
      );
    }

    const { sub: userId, tokenId } = payload;

    if (!tokenId) {
      throw new UnauthorizedException(
        'Token incompatível. Faça login novamente.',
      );
    }

    const deleteResult = await this.dataSource
      .createQueryBuilder()
      .delete()
      .from(RefreshToken)
      .where('token_id = :tokenId', { tokenId })
      .andWhere('user_id = :userId', { userId })
      .execute();

    if (deleteResult.affected === 0) {
      await this.refreshTokenRepo.delete({ user: { id: userId } });
      throw new UnauthorizedException(
        'Token já utilizado. Por segurança, todas as sessões foram encerradas.',
      );
    }

    const user = await this.usersService.findOne(userId);
    return this.generateTokens(user);
  }

  async limparTokensExpirados() {
    await this.refreshTokenRepo
      .createQueryBuilder()
      .delete()
      .where('expires_at < NOW()')
      .execute();
  }

  async login(user: any) {
    await this.refreshTokenRepo.delete({ user: { id: user.id } });
    return this.generateTokens(user);
  }

  async logout(userId: string) {
    await this.refreshTokenRepo.delete({ user: { id: userId } });
    return { message: 'Logout realizado com sucesso.' };
  }

  async validateGoogleUser(googleUser: any) {
    const { email, name, googleId } = googleUser;
    const user = await this.usersService.createViaGoogle(name, email, googleId);
    return this.generateTokens(user);
  }
}
