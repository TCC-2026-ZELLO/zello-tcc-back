/**
 * Validação das variáveis de ambiente na inicialização (v5.0.0-13.3.1).
 * A aplicação não sobe com segredo ausente, fraco ou de exemplo.
 */
const PLACEHOLDER_SECRETS = [
  'changeme',
  'change-me',
  'secret',
  'jwt_secret',
  'your_jwt_secret',
  'sua_chave_secreta',
  'zello',
];

const REQUIRED = ['JWT_SECRET', 'DB_HOST', 'DB_USER', 'DB_PASS', 'DB_NAME'];

export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const errors: string[] = [];
  const isProd = config.NODE_ENV === 'production';
  const isTest = config.NODE_ENV === 'test';

  for (const name of REQUIRED) {
    const value = config[name];
    if (typeof value !== 'string' || value.trim() === '') {
      if (!isTest) errors.push(`${name} é obrigatória.`);
    }
  }

  const jwtSecret =
    typeof config.JWT_SECRET === 'string' ? config.JWT_SECRET : '';
  if (jwtSecret) {
    if (isProd && Buffer.byteLength(jwtSecret, 'utf8') < 32) {
      errors.push(
        'JWT_SECRET deve ter pelo menos 32 bytes em produção (HS256 exige chave de 256 bits).',
      );
    }
    if (isProd && PLACEHOLDER_SECRETS.includes(jwtSecret.toLowerCase())) {
      errors.push('JWT_SECRET está com um valor de exemplo.');
    }
  }

  if (isProd) {
    const origins =
      typeof config.CORS_ALLOWED_ORIGINS === 'string'
        ? config.CORS_ALLOWED_ORIGINS
        : '';
    if (origins.includes('*')) {
      errors.push('CORS_ALLOWED_ORIGINS não pode conter curinga (*).');
    }
    const frontend =
      typeof config.FRONTEND_BASE_URL === 'string'
        ? config.FRONTEND_BASE_URL
        : '';
    if (!frontend.startsWith('https://')) {
      errors.push('FRONTEND_BASE_URL deve usar https:// em produção.');
    }
    if (config.DB_SYNCHRONIZE === 'true') {
      errors.push('DB_SYNCHRONIZE=true não é permitido em produção.');
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Configuração de ambiente inválida:\n - ${errors.join('\n - ')}`,
    );
  }
  return config;
}
