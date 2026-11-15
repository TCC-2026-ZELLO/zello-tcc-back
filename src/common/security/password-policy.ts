import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { COMMON_PASSWORDS } from './common-passwords';

/**
 * Política de senhas do Zello (decisão documentada em
 * docs/security/ESPECIFICACAO_DIRETRIZES_SEGURANCA_ZELLO.md, seção V6).
 *
 * - v5.0.0-6.2.1: mínimo de 8 caracteres (15+ recomendado ao usuário).
 * - v5.0.0-6.2.4: bloqueio das 3.000 senhas mais comuns.
 * - v5.0.0-6.2.5: nenhuma regra de composição (maiúsculas, dígitos, símbolos).
 * - v5.0.0-6.2.8: a senha é verificada exatamente como recebida; como o bcrypt
 *   ignora bytes além do 72º, senhas maiores são recusadas em vez de truncadas.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_RECOMMENDED_LENGTH = 15;
export const PASSWORD_MAX_BYTES = 72;

/** Termos de contexto da aplicação que não podem ser usados como senha. */
const CONTEXT_WORDS = ['zello', 'zelloapp', 'zello2026', 'pucpr'];

export type PasswordPolicyViolation =
  | 'TOO_SHORT'
  | 'TOO_LONG'
  | 'COMMON_PASSWORD'
  | 'CONTEXT_WORD';

export function checkPasswordPolicy(
  password: unknown,
): PasswordPolicyViolation | null {
  if (typeof password !== 'string') return 'TOO_SHORT';

  // Conta caracteres Unicode (code points), não unidades UTF-16.
  if (Array.from(password).length < PASSWORD_MIN_LENGTH) return 'TOO_SHORT';
  if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) {
    return 'TOO_LONG';
  }

  const normalized = password.toLowerCase();
  if (COMMON_PASSWORDS.has(normalized)) return 'COMMON_PASSWORD';

  const stripped = normalized.replace(/[^a-z]/g, '');
  if (CONTEXT_WORDS.some((word) => stripped === word)) return 'CONTEXT_WORD';

  return null;
}

export const PASSWORD_POLICY_MESSAGES: Record<PasswordPolicyViolation, string> =
  {
    TOO_SHORT: `A senha deve ter no mínimo ${PASSWORD_MIN_LENGTH} caracteres (recomendamos ${PASSWORD_RECOMMENDED_LENGTH} ou mais).`,
    TOO_LONG: `A senha deve ter no máximo ${PASSWORD_MAX_BYTES} bytes.`,
    COMMON_PASSWORD:
      'Esta senha é muito comum e aparece em listas de senhas vazadas. Escolha outra.',
    CONTEXT_WORD: 'A senha não pode ser o nome da plataforma. Escolha outra.',
  };

/** Decorator de DTO que aplica a política de senhas no backend (v5.0.0-2.2.2). */
export function IsAcceptablePassword(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isAcceptablePassword',
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate(value: unknown) {
          return checkPasswordPolicy(value) === null;
        },
        defaultMessage(args: ValidationArguments) {
          const violation = checkPasswordPolicy(args.value);
          return violation
            ? PASSWORD_POLICY_MESSAGES[violation]
            : 'Senha inválida.';
        },
      },
    });
  };
}
