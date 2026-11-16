import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import {
  cookieNames,
  oauthCookieOptions,
} from '../../../config/security.config';

export const OAUTH_ACCOUNT_TYPES = [
  'CLIENTE',
  'PROFISSIONAL',
  'ESTABELECIMENTO',
] as const;
export type OAuthAccountType = (typeof OAUTH_ACCOUNT_TYPES)[number];

interface StoredState {
  /** Valor aleatório enviado ao Google no parâmetro `state`. */
  n: string;
  /** code_verifier do PKCE. */
  v: string;
  /** Tipo de conta escolhido antes do redirecionamento (allowlist). */
  t: OAuthAccountType | null;
  /** Expiração em epoch ms. */
  e: number;
}

type StoreCallback = (err: Error | null, state?: string) => void;
type VerifyCallback = (
  err: Error | null,
  ok?: string | false,
  state?: unknown,
) => void;

const TTL_MS = 10 * 60 * 1000;

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Armazenamento do `state` e do `code_verifier` do OAuth sem sessão de servidor
 * (v5.0.0-10.1.2, 10.2.1).
 *
 * Antes de redirecionar ao Google a aplicação gera um `state` aleatório de 256
 * bits (CSPRNG) e o `code_verifier` do PKCE, e guarda ambos em um cookie
 * HttpOnly assinado com HMAC-SHA256. No retorno, o código de autorização só é
 * aceito se o `state` recebido for igual ao do cookie do MESMO navegador. Um
 * atacante não consegue plantar a própria resposta de autorização na sessão da
 * vítima (CSRF de login) nem trocar um código interceptado, pois não possui o
 * `code_verifier`. O cookie é de uso único e expira em 10 minutos.
 */
export class OAuthStateStore {
  constructor(private readonly secret: string) {
    if (!secret) throw new Error('OAuthStateStore requer um segredo.');
  }

  private sign(payload: string): string {
    return createHmac('sha256', `oauth-state:${this.secret}`)
      .update(payload)
      .digest('base64url');
  }

  private encode(state: StoredState): string {
    const payload = Buffer.from(JSON.stringify(state)).toString('base64url');
    return `${payload}.${this.sign(payload)}`;
  }

  private decode(raw: unknown): StoredState | null {
    if (typeof raw !== 'string' || !raw.includes('.')) return null;
    const [payload, signature] = raw.split('.');
    if (!payload || !signature) return null;
    if (!safeEqual(signature, this.sign(payload))) return null;
    try {
      const parsed = JSON.parse(
        Buffer.from(payload, 'base64url').toString('utf8'),
      ) as StoredState;
      if (
        typeof parsed.n !== 'string' ||
        typeof parsed.v !== 'string' ||
        typeof parsed.e !== 'number'
      ) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  static normalizeAccountType(value: unknown): OAuthAccountType | null {
    return typeof value === 'string' &&
      (OAUTH_ACCOUNT_TYPES as readonly string[]).includes(value)
      ? (value as OAuthAccountType)
      : null;
  }

  /** Chamado pelo passport-oauth2 antes do redirecionamento (aridade 5 = PKCE). */
  store(
    req: Request,
    verifier: string,
    state: unknown,
    _meta: unknown,
    callback: StoreCallback,
  ): void {
    const nonce = randomBytes(32).toString('base64url');
    const accountType = OAuthStateStore.normalizeAccountType(
      (state as { accountType?: unknown } | undefined)?.accountType,
    );
    const value = this.encode({
      n: nonce,
      v: verifier,
      t: accountType,
      e: Date.now() + TTL_MS,
    });
    if (!req.res) return callback(new Error('Resposta HTTP indisponível.'));
    req.res.cookie(cookieNames.oauthState(), value, oauthCookieOptions());
    callback(null, nonce);
  }

  /** Chamado no retorno do Google (aridade 3). Devolve o code_verifier. */
  verify(req: Request, providedState: string, callback: VerifyCallback): void {
    const name = cookieNames.oauthState();
    const stored = this.decode(req.cookies?.[name]);

    // Uso único: o cookie é removido independentemente do resultado.
    if (req.res) {
      const { maxAge, ...clearOptions } = oauthCookieOptions();
      void maxAge;
      req.res.clearCookie(name, clearOptions);
    }

    if (
      !stored ||
      stored.e < Date.now() ||
      typeof providedState !== 'string' ||
      !safeEqual(stored.n, providedState)
    ) {
      return callback(null, false, {
        message: 'Parâmetro state inválido ou expirado.',
      });
    }

    (
      req as Request & { oauthAccountType?: OAuthAccountType | null }
    ).oauthAccountType = stored.t;
    callback(null, stored.v, { accountType: stored.t });
  }
}
