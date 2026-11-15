import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Not, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { AuthProvider } from '../users/entities/user.entity';
import { RefreshToken } from '../users/entities/refresh-token.entity';
import { PasswordReset } from '../users/entities/password-reset.entity';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { MailerService } from '@nestjs-modules/mailer';
import * as bcrypt from 'bcrypt';
import { randomUUID, randomBytes, createHash } from 'crypto';
import {
  JWT_ALGORITHM,
  JWT_AUDIENCE_ACCESS,
  JWT_AUDIENCE_REFRESH,
  JWT_ISSUER,
  sessionConfig,
} from '../../config/security.config';
import { LoginAttemptLimiter } from './login-attempt.limiter';

/**
 * Hash bcrypt (custo 10) de um valor aleatório descartado. Usado para gastar o
 * mesmo tempo de CPU quando o e-mail não existe, de modo que o tempo de
 * resposta não revele quais contas estão cadastradas.
 */
const TIMING_EQUALIZER_HASH =
  '$2b$10$TyO23hUoVfeTXF.Wo/fd0.KTFewRmQ77nJiDyGYfZMHZoq3MCVvuC';

const INVALID_CREDENTIALS = 'E-mail ou senha incorretos.';

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
    private readonly loginLimiter: LoginAttemptLimiter,
  ) {}

  /**
   * Confere e-mail e senha. A resposta é idêntica para e-mail inexistente,
   * conta Google, conta desativada e senha errada (sem enumeração de contas).
   */
  async validateUser(email: string, pass: string): Promise<any> {
    this.loginLimiter.assertNotLocked(email);

    const user = await this.usersService.findByEmailWithPassword(email);

    const hash =
      user && user.provider !== AuthProvider.GOOGLE && user.passwordHash
        ? user.passwordHash
        : TIMING_EQUALIZER_HASH;
    const isMatch = await bcrypt.compare(pass, hash);

    if (
      !user ||
      user.provider === AuthProvider.GOOGLE ||
      !user.passwordHash ||
      !isMatch ||
      user.isActive === false
    ) {
      this.loginLimiter.registerFailure(email);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    this.loginLimiter.registerSuccess(email);
    const { passwordHash, ...result } = user;
    void passwordHash;
    return result;
  }

  private publicUser(user: any) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      roles: user.roles?.map((p: any) => p.name ?? p) || [],
      provider: user.provider,
    };
  }

  private signAccessToken(userId: string, sessionId: string): string {
    return this.jwtService.sign(
      { sub: userId, sid: sessionId, typ: 'access' },
      {
        algorithm: JWT_ALGORITHM,
        expiresIn: sessionConfig.accessTokenTtlSeconds(),
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE_ACCESS,
      },
    );
  }

  private signRefreshToken(
    userId: string,
    sessionId: string,
    tokenId: string,
    expiresAt: Date,
  ): string {
    const ttlSeconds = Math.max(
      1,
      Math.floor((expiresAt.getTime() - Date.now()) / 1000),
    );
    return this.jwtService.sign(
      { sub: userId, sid: sessionId, tokenId, typ: 'refresh' },
      {
        algorithm: JWT_ALGORITHM,
        expiresIn: ttlSeconds,
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE_REFRESH,
      },
    );
  }

  /** Expiração do refresh token: o menor entre inatividade e vida máxima da sessão. */
  private computeExpiry(sessionStartedAt: Date, now: Date): Date {
    const idle = now.getTime() + sessionConfig.idleTimeoutSeconds() * 1000;
    const absolute =
      sessionStartedAt.getTime() + sessionConfig.absoluteTimeoutSeconds() * 1000;
    return new Date(Math.min(idle, absolute));
  }

  /** Abre uma sessão nova para o usuário e emite o par de tokens. */
  async generateTokens(user: any) {
    const now = new Date();
    const tokenId = randomUUID();
    const expiresAt = this.computeExpiry(now, now);

    const session = await this.refreshTokenRepo.save({
      tokenId,
      user: { id: user.id },
      sessionStartedAt: now,
      lastUsedAt: now,
      expiresAt,
    });

    return {
      access_token: this.signAccessToken(user.id, session.id),
      refresh_token: this.signRefreshToken(
        user.id,
        session.id,
        tokenId,
        expiresAt,
      ),
      refresh_expires_at: expiresAt,
      user: this.publicUser(user),
    };
  }

  /**
   * Troca o refresh token (rotação com detecção de reuso). Um refresh token já
   * utilizado indica cópia do token: todas as sessões do usuário são encerradas.
   */
  async refresh(refreshToken: string) {
    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken, {
        algorithms: [JWT_ALGORITHM],
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE_REFRESH,
      });
    } catch (err) {
      throw new UnauthorizedException(
        err?.name === 'TokenExpiredError'
          ? 'Sessão expirada. Faça login novamente.'
          : 'Refresh token inválido.',
      );
    }

    const { sub: userId, tokenId, sid: sessionId, typ } = payload;

    if (typ !== 'refresh' || !tokenId || !sessionId || !userId) {
      throw new UnauthorizedException(
        'Token incompatível. Faça login novamente.',
      );
    }

    const session = await this.refreshTokenRepo.findOne({
      where: { id: sessionId, user: { id: userId } },
    });

    if (!session || session.tokenId !== tokenId) {
      await this.refreshTokenRepo.delete({ user: { id: userId } });
      this.logger.warn(
        JSON.stringify({
          type: 'security_event',
          timestamp: new Date().toISOString(),
          event: 'refresh_token_reuse',
          userId,
        }),
      );
      throw new UnauthorizedException(
        'Token já utilizado. Por segurança, todas as sessões foram encerradas.',
      );
    }

    const now = new Date();
    const idleLimit =
      session.lastUsedAt.getTime() + sessionConfig.idleTimeoutSeconds() * 1000;
    const absoluteLimit =
      session.sessionStartedAt.getTime() +
      sessionConfig.absoluteTimeoutSeconds() * 1000;

    if (now.getTime() > idleLimit || now.getTime() > absoluteLimit) {
      await this.refreshTokenRepo.delete({ id: session.id });
      throw new UnauthorizedException(
        'Sessão expirada. Faça login novamente.',
      );
    }

    const user = await this.usersService.findOne(userId);
    if (user.isActive === false) {
      await this.refreshTokenRepo.delete({ user: { id: userId } });
      throw new UnauthorizedException('Sessão encerrada.');
    }

    const newTokenId = randomUUID();
    const expiresAt = this.computeExpiry(session.sessionStartedAt, now);

    // Troca atômica: só uma requisição concorrente consegue usar o token antigo.
    const result = await this.dataSource
      .createQueryBuilder()
      .update(RefreshToken)
      .set({ tokenId: newTokenId, lastUsedAt: now, expiresAt })
      .where('id = :id', { id: session.id })
      .andWhere('token_id = :tokenId', { tokenId })
      .execute();

    if (!result.affected) {
      await this.refreshTokenRepo.delete({ user: { id: userId } });
      throw new UnauthorizedException(
        'Token já utilizado. Por segurança, todas as sessões foram encerradas.',
      );
    }

    return {
      access_token: this.signAccessToken(userId, session.id),
      refresh_token: this.signRefreshToken(
        userId,
        session.id,
        newTokenId,
        expiresAt,
      ),
      refresh_expires_at: expiresAt,
      user: this.publicUser(user),
    };
  }

  /** Usada pela JwtStrategy: a sessão do token ainda existe e não expirou? */
  async isSessionActive(userId: string, sessionId: string): Promise<boolean> {
    if (!userId || !sessionId) return false;
    const session = await this.refreshTokenRepo.findOne({
      where: { id: sessionId, user: { id: userId } },
    });
    return !!session && session.expiresAt.getTime() > Date.now();
  }

  async limparTokensExpirados() {
    await this.refreshTokenRepo
      .createQueryBuilder()
      .delete()
      .where('expires_at < NOW()')
      .execute();
  }

  /** Login: descarta sessões anteriores e cria uma nova (v5.0.0-7.2.4). */
  async login(user: any) {
    await this.refreshTokenRepo.delete({ user: { id: user.id } });
    return this.generateTokens(user);
  }

  async logout(userId: string) {
    await this.refreshTokenRepo.delete({ user: { id: userId } });
    return { message: 'Logout realizado com sucesso.' };
  }

  /**
   * Encerra sessões de um usuário (v5.0.0-7.4.2, 7.4.3, 7.4.5).
   * `exceptSessionId` preserva a sessão de quem acabou de trocar a própria senha.
   */
  async revokeSessions(userId: string, exceptSessionId?: string) {
    const result = exceptSessionId
      ? await this.refreshTokenRepo.delete({
          user: { id: userId },
          id: Not(exceptSessionId),
        })
      : await this.refreshTokenRepo.delete({ user: { id: userId } });
    return { revoked: result.affected ?? 0 };
  }

  async validateGoogleUser(googleUser: any) {
    const { email, name, googleId, accountType, emailVerified } = googleUser;

    if (!email || emailVerified !== true) {
      throw new ForbiddenException(
        'O e-mail da conta Google precisa estar verificado.',
      );
    }

    const user = await this.usersService.createViaGoogle(
      name,
      email,
      googleId,
      accountType,
    );
    if (user.isActive === false) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    await this.refreshTokenRepo.delete({ user: { id: user.id } });
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

    // v5.0.0-6.5.3: token de 256 bits gerado por CSPRNG; só o hash é persistido.
    const rawToken = randomBytes(32).toString('hex');
    const hashedToken = createHash('sha256').update(rawToken).digest('hex');

    const ttlMinutes = sessionConfig.passwordResetTtlMinutes();
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

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

    // v5.0.0-14.2.1: o token vai no fragmento (#), que o navegador não envia ao
    // servidor e que não aparece em logs de acesso nem no cabeçalho Referer.
    const resetUrl = new URL('/redefinir-senha', frontendBaseUrl);
    resetUrl.hash = `token=${rawToken}`;
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
          <p>Clique no botão abaixo para prosseguir. Este link é válido por <strong>${ttlMinutes} minutos</strong> e só pode ser usado uma vez.</p>
          <a href="${this.escapeHtml(resetLink).replace(/&#x2F;/g, '/')}"
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

      // v5.0.0-7.4.3: trocar a senha encerra todas as sessões abertas.
      await refreshTokenRepo.delete({
        user: { id: resetRecord.user.id },
      });

      // Uso único: o token é apagado na mesma transação.
      await passwordResetRepo.delete(resetRecord.id);
    });
    return { message: 'Senha atualizada com sucesso!' };
  }
}
