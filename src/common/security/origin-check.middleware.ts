import { ForbiddenException, Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { getAllowedOrigins } from '../../config/security.config';
import { SecurityEventLogger } from '../logging/security-event.logger';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Defesa contra CSRF (v5.0.0-3.5.1) que não depende do preflight de CORS.
 *
 * Requisições de formulário (multipart/form-data, x-www-form-urlencoded) não
 * disparam preflight, então toda requisição que altera estado precisa provar
 * que veio de uma origem confiável:
 *  - se o navegador enviou `Origin`, ele precisa estar na allowlist;
 *  - se não enviou, `Sec-Fetch-Site` não pode indicar origem cruzada.
 * Clientes que não são navegadores (sem ambos os cabeçalhos) não carregam
 * cookies de vítimas e seguem para a autenticação normal.
 */
@Injectable()
export class OriginCheckMiddleware implements NestMiddleware {
  constructor(private readonly securityEvents: SecurityEventLogger) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    if (SAFE_METHODS.has(req.method.toUpperCase())) return next();

    const origin = req.headers.origin;
    const fetchSite = req.headers['sec-fetch-site'];
    const allowed = getAllowedOrigins();

    let trusted = true;
    if (typeof origin === 'string' && origin.length > 0) {
      trusted = allowed.includes(origin);
    } else if (typeof fetchSite === 'string') {
      trusted = fetchSite === 'same-origin' || fetchSite === 'none';
    }

    if (!trusted) {
      this.securityEvents.log('csrf_origin_rejected', req, {
        origin: typeof origin === 'string' ? origin : null,
        fetchSite: typeof fetchSite === 'string' ? fetchSite : null,
      });
      throw new ForbiddenException('Origem da requisição não autorizada.');
    }
    next();
  }
}
