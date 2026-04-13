import { validate } from 'class-validator';
import { ResetPasswordDto } from './reset-password.dto';
import { plainToInstance } from 'class-transformer';

describe('ResetPasswordDto', () => {
  it('deve falhar se a senha não seguir o padrão de segurança', async () => {
    const dtoObj = {
      token: 'token-valido',
      newPassword: '123', // Senha fraca
    };

    const ofDto = plainToInstance(ResetPasswordDto, dtoObj);
    const errors = await validate(ofDto);

    expect(errors.length).toBeGreaterThan(0);

    // CORREÇÃO: Ajustado para bater com a mensagem real do DTO
    const matchesError = errors.find((e) => e.property === 'newPassword')
      ?.constraints?.matches;
    expect(matchesError).toContain(
      'A senha deve conter letras maiúsculas, minúsculas, números ou caracteres especiais.',
    );
  });

  it('deve passar com uma senha que cumpre todos os requisitos', async () => {
    const dtoObj = {
      token: 'token-valido',
      newPassword: 'SenhaForte@2026',
    };

    const ofDto = plainToInstance(ResetPasswordDto, dtoObj);
    const errors = await validate(ofDto);

    expect(errors.length).toBe(0);
  });
});
