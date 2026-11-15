import type { CookieOptions } from 'express';

/**
 * Parâmetros de segurança lidos do ambiente (v5.0.0-13.3.1: nenhum segredo ou
 * parâmetro sensível fica fixo no código). Os valores padrão são os descritos
 * em docs/security/ESPECIFICACAO_DIRETRIZES_SEGURANCA_ZELLO.md.
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

function intFromEnv(name: string, fallback: number, min: number, max: number) {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return fallback;
  return parsed;
}

const DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:4000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
];

/**
 * Allowlist exata de origens para CORS e verificação de Origin
 * (v5.0.0-3.4.2, 3.5.1, 3.5.2). Nunca usa curinga nem comparação por prefixo.
 * Em produção só valem as origens HTTPS declaradas em CORS_ALLOWED_ORIGINS.
 */
export function getAllowedOrigins(): string[] {
  const configured = (process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter((origin) => origin.length > 0 && origin !== '*');

  if (isProduction()) {
    return configured.filter((origin) => origin.startsWith('https://'));
  }
  return Array.from(new Set([...configured, ...DEV_ORIGINS]));
}

export const sessionConfig = {
  /** v5.0.0-7.4.1 / proposta: vida curta do token de acesso. */
  accessTokenTtlSeconds: () =>
    intFromEnv('ACCESS_TOKEN_TTL_MINUTES', 15, 1, 60) * 60,
  /** v5.0.0-7.3.1: tempo máximo sem atividade antes de exigir novo login. */
  idleTimeoutSeconds: () =>
    intFromEnv('SESSION_IDLE_TIMEOUT_MINUTES', 30, 5, 24 * 60) * 60,
  /** v5.0.0-7.3.2: vida máxima absoluta de uma sessão. */
  absoluteTimeoutSeconds: () =>
    intFromEnv('SESSION_ABSOLUTE_TIMEOUT_HOURS', 7 * 24, 1, 30 * 24) * 3600,
  /** v5.0.0-6.5.5: link de redefinição vale no máximo 10 minutos. */
  passwordResetTtlMinutes: () =>
    intFromEnv('PASSWORD_RESET_TTL_MINUTES', 10, 5, 10),
};

export const JWT_ALGORITHM = 'HS256' as const;
export const JWT_ISSUER = 'zello-api';
export const JWT_AUDIENCE_ACCESS = 'zello-web';
export const JWT_AUDIENCE_REFRESH = 'zello-refresh';

type SameSite = 'strict' | 'lax' | 'none';

function sameSiteFromEnv(): SameSite {
  const raw = (process.env.COOKIE_SAMESITE ?? '').toLowerCase();
  if (raw === 'strict' || raw === 'lax' || raw === 'none') return raw;
  // Padrão: front e API no mesmo site (proxy /api no nginx do frontend).
  return isProduction() ? 'strict' : 'lax';
}

/**
 * Nomes dos cookies de sessão. Em produção usam o prefixo `__Host-`
 * (v5.0.0-3.3.3), que o navegador só aceita com Secure, Path=/ e sem Domain.
 * Em desenvolvimento (HTTP) o prefixo não é aceito pelos navegadores.
 */
export const cookieNames = {
  access: () => (isProduction() ? '__Host-zello_at' : 'access_token'),
  refresh: () => (isProduction() ? '__Host-zello_rt' : 'refresh_token'),
  oauthState: () => (isProduction() ? '__Host-zello_oauth' : 'zello_oauth'),
};

/** v5.0.0-3.3.1, 3.3.2, 3.3.4: Secure, SameSite e HttpOnly em todos os cookies de sessão. */
export function sessionCookieOptions(maxAgeSeconds: number): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: sameSiteFromEnv(),
    path: '/',
    maxAge: maxAgeSeconds * 1000,
  };
}

export function clearCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: sameSiteFromEnv(),
    path: '/',
  };
}

/**
 * Cookie do fluxo OAuth: precisa ser Lax porque o retorno do Google é uma
 * navegação de nível superior iniciada por outro site.
 */
export function oauthCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60 * 1000,
  };
}

/** Número de proxies confiáveis à frente da API (v5.0.0-4.1.3). */
export function trustedProxyHops(): number {
  return intFromEnv('TRUST_PROXY_HOPS', isProduction() ? 1 : 0, 0, 5);
}

export const rateLimitConfig = {
  globalPerMinute: () =>
    intFromEnv('RATE_LIMIT_GLOBAL_PER_MINUTE', 300, 10, 10000),
  loginPerMinute: () => intFromEnv('RATE_LIMIT_LOGIN_PER_MINUTE', 5, 1, 100),
  loginPerAccountWindowMinutes: 15,
  loginPerAccountLimit: () =>
    intFromEnv('RATE_LIMIT_LOGIN_PER_ACCOUNT', 10, 3, 100),
  passwordRecoveryPerHour: () =>
    intFromEnv('RATE_LIMIT_RECOVERY_PER_HOUR', 5, 1, 100),
  registrationPerHour: () =>
    intFromEnv('RATE_LIMIT_REGISTRATION_PER_HOUR', 10, 1, 1000),
};
