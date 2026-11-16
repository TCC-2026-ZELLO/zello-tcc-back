import { validate } from 'class-validator';
import { ResetPasswordDto } from './reset-password.dto';
import { plainToInstance } from 'class-transformer';

const VALID_TOKEN = 'a'.repeat(64);

async function errorsFor(newPassword: string, token = VALID_TOKEN) {
  const dto = plainToInstance(ResetPasswordDto, { token, newPassword });
  return validate(dto);
}

describe('ResetPasswordDto', () => {
  it('deve falhar se a senha tiver menos de 8 caracteres (v5.0.0-6.2.1)', async () => {
    const errors = await errorsFor('123');
    const message = errors.find((e) => e.property === 'newPassword')
      ?.constraints?.isAcceptablePassword;
    expect(message).toContain('no mínimo 8 caracteres');
  });

  it('deve recusar senha presente na lista de senhas comuns (v5.0.0-6.2.4)', async () => {
    const errors = await errorsFor('password123');
    expect(
      errors.find((e) => e.property === 'newPassword')?.constraints
        ?.isAcceptablePassword,
    ).toContain('muito comum');
  });

  it('não deve exigir regras de composição (v5.0.0-6.2.5)', async () => {
    // Frase longa, só minúsculas e espaços: aceita.
    expect(await errorsFor('cavalo bateria grampo correto')).toHaveLength(0);
    expect(await errorsFor('SenhaForte@2026')).toHaveLength(0);
  });

  it('deve recusar token fora do formato esperado', async () => {
    const errors = await errorsFor('cavalo bateria grampo', 'token-invalido');
    expect(errors.some((e) => e.property === 'token')).toBe(true);
  });
});
