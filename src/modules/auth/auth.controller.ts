import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import {
  clearCookieOptions,
  cookieNames,
  sessionConfig,
  sessionCookieOptions,
} from '../../config/security.config';
import { SecurityEventLogger } from '../../common/logging/security-event.logger';
import { ExposeContactData } from '../../common/security/sensitive-data.interceptor';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@ApiTags('auth')
@Controller('auth')
// As rotas de autenticação só devolvem a conta do próprio usuário.
@ExposeContactData()
export class AuthController {
  constructor(
    private authService: AuthService,
    private readonly securityEvents: SecurityEventLogger,
  ) {}

  /**
   * Grava os cookies de sessão (v5.0.0-3.3.1 a 3.3.4): HttpOnly, Secure,
   * SameSite e prefixo __Host- em produção. Os tokens nunca vão no corpo da
   * resposta nem ficam acessíveis ao JavaScript da página.
   */
  private setSessionCookies(
    res: Response,
    data: {
      access_token: string;
      refresh_token: string;
      refresh_expires_at?: Date;
    },
  ) {
    const refreshMaxAge = data.refresh_expires_at
      ? Math.max(
          1,
          Math.floor((data.refresh_expires_at.getTime() - Date.now()) / 1000),
        )
      : sessionConfig.idleTimeoutSeconds();

    res.cookie(
      cookieNames.access(),
      data.access_token,
      sessionCookieOptions(sessionConfig.accessTokenTtlSeconds()),
    );
    res.cookie(
      cookieNames.refresh(),
      data.refresh_token,
      sessionCookieOptions(refreshMaxAge),
    );
  }

  private clearSessionCookies(res: Response) {
    res.clearCookie(cookieNames.access(), clearCookieOptions());
    res.clearCookie(cookieNames.refresh(), clearCookieOptions());
  }

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Autenticar usuário com e-mail e senha',
    description:
      'Valida as credenciais do usuário, gera os tokens JWT (access_token de curta duração, 15 minutos por padrão, e refresh_token rotativo sujeito a limite de inatividade e de vida máxima da sessão), armazena-os em cookies HTTP-Only seguros e retorna os dados públicos do perfil autenticado.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description:
      'Autenticação realizada com sucesso. Cookies HTTP-Only definidos.',
    schema: {
      example: {
        user: {
          id: 'a3f1c2d4-e5b6-4890-abcd-ef1234567890',
          nome: 'Mariana Costa Silva',
          email: 'mariana.costa@zello.com.br',
          roles: ['client'],
          avatarUrl: null,
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Credenciais inválidas (e-mail ou senha incorretos).',
  })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res,
    @Req() req?,
  ) {
    let user;
    try {
      user = await this.authService.validateUser(
        loginDto.email,
        loginDto.password,
      );
    } catch (error) {
      this.securityEvents.log('login_failure', req);
      throw error;
    }

    const data = await this.authService.login(user);
    this.setSessionCookies(res, data);
    this.securityEvents.log('login_success', req, { userId: user.id });

    return { user: data.user };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiCookieAuth('access_token')
  @ApiOperation({
    summary: 'Encerrar sessão do usuário autenticado (Logout)',
    description:
      'Revoga os refresh tokens ativos do usuário no banco de dados e limpa os cookies HTTP-Only access_token e refresh_token do navegador.',
  })
  @ApiResponse({
    status: 200,
    description: 'Sessão encerrada com sucesso.',
    schema: {
      example: {
        message: 'Logged out successfully',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Usuário não autenticado.' })
  async logout(@Req() req, @Res({ passthrough: true }) res) {
    this.clearSessionCookies(res);
    // v5.0.0-14.3.1: pede ao navegador que apague dados da aplicação guardados
    // no cliente (cache, cookies e storage) ao encerrar a sessão.
    res.setHeader('Clear-Site-Data', '"cache", "cookies", "storage"');

    if (req.user && req.user.id) {
      // v5.0.0-7.4.1: a sessão é destruída no backend; o token de acesso
      // deixa de ser aceito imediatamente.
      await this.authService.logout(req.user.id);
      this.securityEvents.log('logout', req);
    }
    return { message: 'Logged out successfully' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiCookieAuth('access_token')
  @ApiOperation({
    summary: 'Obter dados da sessão atual do usuário logado',
    description:
      'Retorna as informações extraídas do token JWT ativo (ID, nome, e-mail, roles e vínculos de perfil) do usuário autenticado via cookie ou header Authorization.',
  })
  @ApiResponse({
    status: 200,
    description: 'Dados do usuário autenticado retornados com sucesso.',
    schema: {
      example: {
        user: {
          id: 'a3f1c2d4-e5b6-4890-abcd-ef1234567890',
          email: 'mariana.costa@zello.com.br',
          nome: 'Mariana Costa Silva',
          roles: ['client'],
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Token ausente ou expirado.' })
  getProfile(@Req() req) {
    return { user: req.user };
  }

  @Post('refresh')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('access_token')
  @ApiOperation({
    summary: 'Renovar token de acesso (Refresh Token)',
    description:
      'Lê o cookie HTTP-Only refresh_token, valida sua integridade e vigência no banco de dados e emite um novo par de cookies access_token e refresh_token (rotação de token).',
  })
  @ApiResponse({
    status: 200,
    description: 'Tokens renovados com sucesso.',
    schema: {
      example: {
        user: {
          id: 'a3f1c2d4-e5b6-4890-abcd-ef1234567890',
          nome: 'Mariana Costa Silva',
          email: 'mariana.costa@zello.com.br',
          roles: ['client'],
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Refresh token ausente, inválido ou expirado.',
  })
  async refresh(@Req() req, @Res({ passthrough: true }) res) {
    const refreshToken = req.cookies?.[cookieNames.refresh()];
    if (!refreshToken) {
      throw new UnauthorizedException('Token de atualização ausente');
    }

    let data;
    try {
      data = await this.authService.refresh(refreshToken);
    } catch (error) {
      this.clearSessionCookies(res);
      this.securityEvents.log('token_refresh_failure', req);
      throw error;
    }

    this.setSessionCookies(res, data);

    return { user: data.user };
  }

  @Get('google')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({
    summary: 'Iniciar fluxo de login social com Google OAuth 2.0',
    description:
      'Redireciona o navegador do usuário para a tela de consentimento oficial do Google OAuth 2.0 solicitando permissões de e-mail e perfil básico.',
  })
  @ApiResponse({
    status: 302,
    description: 'Redirecionamento para accounts.google.com.',
  })
  async googleAuth(@Req() _req) {}

  @Get('google/callback')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({
    summary: 'Callback de retorno da autenticação Google OAuth 2.0',
    description:
      'Recebe o código de autorização do Google, cria ou vincula a conta do usuário na base do Zello, define os cookies HTTP-Only de sessão e redireciona para o frontend (/explore).',
  })
  @ApiResponse({
    status: 302,
    description:
      'Autenticação concluída e redirecionamento para a aplicação frontend.',
  })
  async googleAuthRedirect(@Req() req, @Res() res) {
    const data = await this.authService.validateGoogleUser(req.user);
    this.setSessionCookies(res, data);
    this.securityEvents.log('login_success', req, {
      userId: data.user.id,
      provider: 'google',
    });

    const redirectUrl =
      process.env.GOOGLE_REDIRECT_URL ||
      (process.env.FRONTEND_BASE_URL
        ? new URL('/explore', process.env.FRONTEND_BASE_URL).toString()
        : null);

    if (!redirectUrl) {
      throw new Error(
        'Missing redirect URL configuration. Set GOOGLE_REDIRECT_URL or FRONTEND_BASE_URL.',
      );
    }

    const normalizedRedirectUrl = new URL(redirectUrl);

    if (
      normalizedRedirectUrl.protocol !== 'http:' &&
      normalizedRedirectUrl.protocol !== 'https:'
    ) {
      throw new Error('Invalid redirect URL protocol.');
    }

    return res.redirect(normalizedRedirectUrl.toString());
  }

  @Post('forgot-password')
  @Throttle({ default: { limit: 5, ttl: 60 * 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Solicitar recuperação de senha por e-mail',
    description:
      'Gera um token temporário de redefinição de senha e envia um link de recuperação para o e-mail informado (caso pertença a uma conta ativa). Por segurança, retorna mensagem padronizada evitando enumeração de usuários.',
  })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Solicitação de recuperação processada com sucesso.',
    schema: {
      example: {
        message:
          'Se o e-mail estiver cadastrado, você receberá as instruções para redefinir sua senha.',
      },
    },
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req?) {
    this.securityEvents.log('password_reset_requested', req);
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @Throttle({ default: { limit: 10, ttl: 60 * 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Redefinir senha utilizando token de recuperação',
    description:
      'Valida o token recebido por e-mail, verifica se não está expirado ou já utilizado e atualiza a senha do usuário com hash bcrypt.',
  })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Senha redefinida com sucesso.',
    schema: {
      example: {
        message: 'Senha redefinida com sucesso.',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Token inválido, expirado ou nova senha fora do padrão.',
  })
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req?) {
    try {
      const result = await this.authService.resetPassword(dto);
      this.securityEvents.log('password_reset_completed', req);
      return result;
    } catch (error) {
      this.securityEvents.log('password_reset_failure', req);
      throw error;
    }
  }
}
