import { Injectable, Logger } from '@nestjs/common';
import type { Request } from 'express';

export type SecurityEvent =
  | 'login_success'
  | 'login_failure'
  | 'logout'
  | 'token_refresh_failure'
  | 'refresh_token_reuse'
  | 'password_reset_requested'
  | 'password_reset_completed'
  | 'password_reset_failure'
  | 'password_changed'
  | 'sessions_revoked'
  | 'account_status_changed'
  | 'role_granted'
  | 'authorization_denied'
  | 'authentication_required'
  | 'csrf_origin_rejected'
  | 'rate_limit_exceeded'
  | 'upload_rejected'
  | 'oauth_state_rejected'
  | 'unexpected_error';

/** Chaves cujo valor nunca pode ser gravado em log (v5.0.0-16.2.5). */
const REDACTED_KEYS =
  /pass(word)?|senha|token|secret|authorization|cookie|cpf|hash|credential/i;

export function redact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    return value.length > 300 ? `${value.slice(0, 300)}…` : value;
  }
  if (typeof value !== 'object') return value;
  if (depth > 4) return '[truncado]';
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => redact(item, depth + 1));
  }
  const output: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    output[key] = REDACTED_KEYS.test(key)
      ? '[removido]'
      : redact(inner, depth + 1);
  }
  return output;
}

/** Remove a query string: ela pode carregar dados pessoais ou tokens. */
export function pathOnly(url: string | undefined): string {
  if (!url) return '';
  const index = url.indexOf('?');
  return index === -1 ? url : url.slice(0, index);
}

/**
 * Registro estruturado (JSON, uma linha por evento, horário em UTC) dos eventos
 * de segurança: autenticação, autorização, sessão e validação
 * (v5.0.0-16.2.1, 16.3.1, 16.3.2). Nunca recebe senhas ou tokens.
 */
@Injectable()
export class SecurityEventLogger {
  private readonly logger = new Logger('SecurityEvent');

  log(
    event: SecurityEvent,
    req?: Pick<Request, 'method' | 'originalUrl' | 'ip' | 'headers'> & {
      user?: { id?: string };
      requestId?: string;
    },
    details: Record<string, unknown> = {},
  ): void {
    const entry = {
      type: 'security_event',
      timestamp: new Date().toISOString(),
      event,
      userId: req?.user?.id ?? (details.userId as string | undefined) ?? null,
      ip: req?.ip ?? null,
      method: req?.method ?? null,
      path: pathOnly(req?.originalUrl),
      requestId: req?.requestId ?? null,
      details: redact(details),
    };
    const line = JSON.stringify(entry);
    if (
      event.endsWith('failure') ||
      event.endsWith('rejected') ||
      event.endsWith('denied') ||
      event === 'refresh_token_reuse' ||
      event === 'rate_limit_exceeded' ||
      event === 'unexpected_error'
    ) {
      this.logger.warn(line);
    } else {
      this.logger.log(line);
    }
  }
}
