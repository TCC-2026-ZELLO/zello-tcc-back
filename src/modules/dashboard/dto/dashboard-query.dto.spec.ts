import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DashboardQueryDto } from './dashboard-query.dto';

async function errorsFor(query: Record<string, unknown>): Promise<string[]> {
  const dto = plainToInstance(DashboardQueryDto, query);
  const errors = await validate(dto);
  return errors.flatMap((error) => Object.values(error.constraints ?? {}));
}

describe('DashboardQueryDto', () => {
  it('aceita período válido', async () => {
    await expect(
      errorsFor({ from: '2026-10-01', to: '2026-10-31' }),
    ).resolves.toEqual([]);
  });

  it('rejeita datas ausentes ou inválidas com mensagens em português', async () => {
    const messages = await errorsFor({ from: '2026-02-30' });

    expect(messages).toEqual(
      expect.arrayContaining([
        'A data inicial (from) deve ser uma data válida no formato YYYY-MM-DD.',
        'A data final (to) deve ser uma data válida no formato YYYY-MM-DD.',
      ]),
    );
  });

  it('rejeita to anterior a from', async () => {
    await expect(
      errorsFor({ from: '2026-10-10', to: '2026-10-01' }),
    ).resolves.toEqual([
      'A data final (to) deve ser maior ou igual à data inicial (from).',
    ]);
  });

  it('rejeita intervalo acima de 366 dias', async () => {
    await expect(
      errorsFor({ from: '2025-01-01', to: '2026-01-02' }),
    ).resolves.toEqual(['O período selecionado deve ter no máximo 366 dias.']);
  });
});
