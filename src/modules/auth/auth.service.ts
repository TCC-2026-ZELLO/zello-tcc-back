import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { AuthProvider } from '../users/entities/user.entity';
import { RefreshToken } from '../users/entities/refresh-token.entity';
import { PasswordReset } from '../users/entities/password-reset.entity';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { MailerService } from '@nestjs-modules/mailer';
import * as bcrypt from 'bcrypt';
import { randomUUID, randomBytes, createHash } from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private dataSource: DataSource,
    private usersService: UsersService,
    @InjectRepository(RefreshToken)
    private refreshTokenRepo: Repository<RefreshToken>,
    @InjectRepository(PasswordReset)
    private passwordResetRepo: Repository<PasswordReset>,
    private readonly mailerService: MailerService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findByEmailWithPassword(email);
    console.log(user);

    if (!user) {
      throw new UnauthorizedException('E-mail ou senha incorretos.');
    }

    if (user.provider === AuthProvider.GOOGLE) {
      throw new UnauthorizedException('E-mail ou senha incorretos.');
    }

    const isMatch = await bcrypt.compare(pass, user.passwordHash);

    console.log(`Input Password: ${pass}`);
    console.log(`Hash from DB: ${user.passwordHash}`);
    console.log(`Match Result: ${isMatch}`);

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
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roles: user.roles?.map((p: any) => p.name) || [],
        provider: user.provider,
      },
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
    const { email, name, googleId, accountType } = googleUser;
    const user = await this.usersService.createViaGoogle(
      name,
      email,
      googleId,
      accountType,
    );
    return this.generateTokens(user);
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  async forgotPassword(email: string) {
    const GENERIC_RESPONSE = {
      message:
        'Se o e-mail estiver cadastrado, um link de recuperação será enviado.',
    };

    const user = await this.usersService.findByEmail(email);

    if (!user || user.provider !== AuthProvider.LOCAL) {
      return GENERIC_RESPONSE;
    }

    await this.passwordResetRepo.delete({ user: { id: user.id } });

    const rawToken = randomBytes(32).toString('hex');
    const hashedToken = createHash('sha256').update(rawToken).digest('hex');

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    await this.passwordResetRepo.save({
      hashedToken,
      user: { id: user.id },
      expiresAt,
    });

    const frontendBaseUrl = process.env.FRONTEND_BASE_URL;
    if (!frontendBaseUrl) {
      this.logger.error(
        `FRONTEND_BASE_URL não configurada; e-mail de recuperação não enviado para userId=${user.id}`,
      );
      return GENERIC_RESPONSE;
    }

    const resetUrl = new URL('/redefinir-senha', frontendBaseUrl);
    resetUrl.searchParams.set('token', rawToken);
    const resetLink = resetUrl.toString();

    try {
      const escapedname = this.escapeHtml(user.name);
      await this.mailerService.sendMail({
        to: user.email,
        subject: 'Recuperação de Senha - Zello',
        html: `
        <div style="font-family: sans-serif; color: #333;">
          <h2>Recuperação de Senha</h2>
          <p>Olá, ${escapedname}.</p>
          <p>Você solicitou a redefinição de senha para sua conta no Zello.</p>
          <p>Clique no botão abaixo para prosseguir. Este link é válido por <strong>15 minutos</strong>.</p>
          <a href="${resetLink}" 
             style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
             Redefinir Minha Senha
          </a>
          <p>Se você não solicitou isso, ignore este e-mail.</p>
        </div>
      `,
      });
    } catch (error) {
      this.logger.error(
        `Falha ao enviar e-mail de recuperação para userId=${user.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    return GENERIC_RESPONSE;
  }

  async resetPassword(dto: ResetPasswordDto) {
    const { token, newPassword } = dto;

    const hashedToken = createHash('sha256').update(token).digest('hex');

    await this.passwordResetRepo.manager.transaction(async (manager) => {
      const passwordResetRepo = manager.getRepository(PasswordReset);
      const refreshTokenRepo = manager.getRepository(RefreshToken);

      const resetRecord = await passwordResetRepo
        .createQueryBuilder('passwordReset')
        .setLock('pessimistic_write')
        .innerJoinAndSelect('passwordReset.user', 'user')
        .where('passwordReset.hashedToken = :hashedToken', { hashedToken })
        .getOne();

      if (!resetRecord) {
        throw new UnauthorizedException('Token inválido ou já utilizado.');
      }

      if (resetRecord.expiresAt < new Date()) {
        await passwordResetRepo.delete(resetRecord.id);
        throw new UnauthorizedException(
          'Este token expirou. Solicite um novo link.',
        );
      }

      await this.usersService.updatePassword(
        resetRecord.user.id,
        newPassword,
        manager,
      );

      await refreshTokenRepo.delete({
        user: { id: resetRecord.user.id },
      });

      await passwordResetRepo.delete(resetRecord.id);
    });
    return { message: 'Senha atualizada com sucesso!' };
  }
}
