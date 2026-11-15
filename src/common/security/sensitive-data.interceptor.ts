import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, map } from 'rxjs';

/**
 * Campos que nunca saem em respostas da API (v5.0.0-15.3.1).
 * A lista é aplicada de forma recursiva a qualquer objeto retornado.
 */
const ALWAYS_REMOVED = new Set([
  'passwordHash',
  'password',
  'currentPassword',
  'googleId',
  'cpf',
  'hashedToken',
  'tokenId',
  'refreshTokens',
  'accessToken',
  'refresh_token',
  'access_token',
]);

/** Campos removidos de todo objeto com formato de conta de usuário. */
const REMOVED_FROM_USERS = new Set([
  'phone',
  'emailVerifiedAt',
  'phoneVerifiedAt',
  'deletedAt',
  'isActive',
]);

export const EXPOSE_CONTACT_DATA = 'security:exposeContactData';

/**
 * Marca uma rota cuja resposta pode conter o e-mail de outros usuários.
 * Só deve ser usada em rotas que já restringem o acesso ao dono dos dados ou
 * ao gestor do estabelecimento (v5.0.0-8.1.2: acesso por campo documentado).
 */
export const ExposeContactData = () => SetMetadata(EXPOSE_CONTACT_DATA, true);

export interface StripOptions {
  /** Id do usuário autenticado; o e-mail da própria conta é mantido. */
  requesterId?: string;
  /** Mantém e-mails de terceiros (admin ou rota marcada com ExposeContactData). */
  keepContactData?: boolean;
}

function looksLikeUser(value: Record<string, unknown>): boolean {
  return 'email' in value && ('provider' in value || 'roles' in value);
}

export function stripSensitiveData<T>(
  value: T,
  options: StripOptions = { keepContactData: true },
  seen: WeakSet<object> = new WeakSet(),
): T {
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date || Buffer.isBuffer(value)) return value;
  if (seen.has(value)) return value;
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) =>
      stripSensitiveData(item, options, seen),
    ) as unknown as T;
  }

  const source = value as Record<string, unknown>;
  const isUser = looksLikeUser(source);
  const isOwnAccount =
    isUser && !!options.requesterId && source.id === options.requesterId;

  const output: Record<string, unknown> = {};
  for (const key of Object.keys(source)) {
    if (ALWAYS_REMOVED.has(key)) continue;
    if (isUser && REMOVED_FROM_USERS.has(key)) continue;
    // v5.0.0-15.3.1: o e-mail de terceiros não aparece em listagens públicas
    // (avaliações, perfis, equipe), só para o próprio usuário, para admins e
    // em rotas explicitamente autorizadas.
    if (
      isUser &&
      key === 'email' &&
      !isOwnAccount &&
      !options.keepContactData
    ) {
      continue;
    }
    output[key] = stripSensitiveData(source[key], options, seen);
  }
  return output as T;
}

/**
 * Última barreira contra exposição de dados: remove credenciais, CPF,
 * telefone pessoal e identificadores internos de toda resposta, mesmo que um
 * serviço devolva a entidade inteira por engano.
 */
@Injectable()
export class SensitiveDataInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request =
      context.getType() === 'http'
        ? context
            .switchToHttp()
            .getRequest<{ user?: { id?: string; roles?: string[] } }>()
        : undefined;
    const exposed =
      this.reflector.getAllAndOverride<boolean>(EXPOSE_CONTACT_DATA, [
        context.getHandler(),
        context.getClass(),
      ]) === true;
    const options: StripOptions = {
      requesterId: request?.user?.id,
      keepContactData:
        exposed || (request?.user?.roles?.includes('admin') ?? false),
    };
    return next.handle().pipe(map((body) => stripSensitiveData(body, options)));
  }
}
