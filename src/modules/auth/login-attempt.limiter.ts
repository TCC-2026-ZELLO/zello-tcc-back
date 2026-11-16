import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { rateLimitConfig } from '../../config/security.config';

interface Attempts {
  count: number;
  windowStartedAt: number;
}

/**
 * Limite de tentativas de login por conta (v5.0.0-6.3.1), complementar ao
 * limite por IP do ThrottlerGuard: impede adivinhação de senha distribuída
 * entre vários endereços contra uma mesma conta.
 *
 * O contador vive em memória por réplica e expira sozinho ao fim da janela, de
 * modo que não há bloqueio permanente de conta (evita negação de serviço
 * contra o usuário legítimo).
 */
@Injectable()
export class LoginAttemptLimiter {
  private readonly attempts = new Map<string, Attempts>();
  private readonly maxTrackedAccounts = 50_000;

  private key(email: string): string {
    return email.trim().toLowerCase();
  }

  private windowMs(): number {
    return rateLimitConfig.loginPerAccountWindowMinutes * 60 * 1000;
  }

  /** Lança 429 quando a conta excedeu as tentativas da janela atual. */
  assertNotLocked(email: string, now: number = Date.now()): void {
    const entry = this.attempts.get(this.key(email));
    if (!entry) return;
    if (now - entry.windowStartedAt > this.windowMs()) {
      this.attempts.delete(this.key(email));
      return;
    }
    if (entry.count >= rateLimitConfig.loginPerAccountLimit()) {
      throw new HttpException(
        'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  registerFailure(email: string, now: number = Date.now()): void {
    const key = this.key(email);
    const entry = this.attempts.get(key);
    if (!entry || now - entry.windowStartedAt > this.windowMs()) {
      if (this.attempts.size >= this.maxTrackedAccounts) this.prune(now);
      this.attempts.set(key, { count: 1, windowStartedAt: now });
      return;
    }
    entry.count += 1;
  }

  registerSuccess(email: string): void {
    this.attempts.delete(this.key(email));
  }

  private prune(now: number): void {
    for (const [key, entry] of this.attempts) {
      if (now - entry.windowStartedAt > this.windowMs()) {
        this.attempts.delete(key);
      }
    }
    if (this.attempts.size >= this.maxTrackedAccounts) this.attempts.clear();
  }
}
