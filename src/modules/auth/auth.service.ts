import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { AuthProvider } from '../users/entities/user.entity';
import { RefreshToken } from '../users/entities/refresh-token.entity';
import { PasswordReset } from '../users/entities/password-reset.entity';
import { ResetPasswordDto } from '../auth/dto/reset-password.dto';
import { MailerService } from '@nestjs-modules/mailer';
import * as bcrypt from 'bcrypt';
import { randomUUID, randomBytes, createHash } from 'crypto';

@Injectable()
export class AuthService {
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
      roles: user.papeis?.map((p: any) => p.nome) || [],
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
      usuario: { id: user.id },
      expiresAt,
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: { id: user.id, nome: user.nome, email: user.email },
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
      .andWhere('usuario_id = :userId', { userId })
      .execute();

    if (deleteResult.affected === 0) {
      await this.refreshTokenRepo.delete({ usuario: { id: userId } });
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
    await this.refreshTokenRepo.delete({ usuario: { id: user.id } });
    return this.generateTokens(user);
  }

  async logout(userId: string) {
    await this.refreshTokenRepo.delete({ usuario: { id: userId } });
    return { message: 'Logout realizado com sucesso.' };
  }

  async validateGoogleUser(googleUser: any) {
    const { email, nome, googleId } = googleUser;
    const user = await this.usersService.createViaGoogle(nome, email, googleId);
    return this.generateTokens(user);
  }

  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      return {
        message:
          'Se o e-mail estiver cadastrado, um link de recuperação será enviado.',
      };
    }

    await this.passwordResetRepo.delete({ usuario: { id: user.id } });

    const rawToken = randomBytes(32).toString('hex');
    const hashedToken = createHash('sha256').update(rawToken).digest('hex');

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    await this.passwordResetRepo.save({
      hashedToken,
      usuario: { id: user.id },
      expiresAt,
    });

    const frontendBaseUrl = process.env.FRONTEND_BASE_URL;
    if (!frontendBaseUrl) {
      throw new Error('FRONTEND_BASE_URL não configurada.');
    }

    const resetUrl = new URL('/redefinir-senha', frontendBaseUrl);
    resetUrl.hash = `token=${encodeURIComponent(rawToken)}`;
    const resetLink = resetUrl.toString();
    try {
      await this.mailerService.sendMail({
        to: user.email,
        subject: 'Recuperação de Senha - Zello',
        html: `
        <div style="font-family: sans-serif; color: #333;">
          <h2>Recuperação de Senha</h2>
          <p>Olá, ${user.nome}.</p>
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
      console.error('Falha ao enviar e-mail:', error);
    }

    return { message: 'Link de recuperação enviado com sucesso.' };
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
        .leftJoinAndSelect('passwordReset.usuario', 'usuario')
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

      await this.usersService.updatePassword(resetRecord.usuario.id, newPassword);

      await refreshTokenRepo.delete({
        usuario: { id: resetRecord.usuario.id },
      });

      await passwordResetRepo.delete(resetRecord.id);
    });
    return { message: 'Senha atualizada com sucesso!' };
  }
}
