import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SearchServicesByLocationDto } from './search-services-by-location.dto';

/**
 * Cenário "Validação: Coordenadas inválidas rejeitadas com erro 400".
 *
 * O ValidationPipe global (main.ts, `whitelist + transform: true`) usa
 * exatamente estas regras de class-validator para responder 400 antes de a
 * requisição chegar ao Controller — por isso a validação é testada
 * diretamente no DTO, sem precisar subir a aplicação inteira.
 */
describe('SearchServicesByLocationDto', () => {
  async function validateInput(input: Record<string, unknown>) {
    const dto = plainToInstance(SearchServicesByLocationDto, input);
    return validate(dto);
  }

  it('aceita latitude e longitude válidas', async () => {
    const errors = await validateInput({ latitude: -25.4284, longitude: -49.2733 });
    expect(errors).toHaveLength(0);
  });

  it('aceita coordenadas nos limites exatos (-90/-180 e 90/180)', async () => {
    expect(await validateInput({ latitude: -90, longitude: -180 })).toHaveLength(0);
    expect(await validateInput({ latitude: 90, longitude: 180 })).toHaveLength(0);
  });

  it('rejeita latitude acima de 90', async () => {
    const errors = await validateInput({ latitude: 91, longitude: -49.2733 });
    expect(errors.some((error) => error.property === 'latitude')).toBe(true);
  });

  it('rejeita latitude abaixo de -90', async () => {
    const errors = await validateInput({ latitude: -91, longitude: -49.2733 });
    expect(errors.some((error) => error.property === 'latitude')).toBe(true);
  });

  it('rejeita longitude acima de 180', async () => {
    const errors = await validateInput({ latitude: -25.4284, longitude: 181 });
    expect(errors.some((error) => error.property === 'longitude')).toBe(true);
  });

  it('rejeita longitude abaixo de -180', async () => {
    const errors = await validateInput({ latitude: -25.4284, longitude: -181 });
    expect(errors.some((error) => error.property === 'longitude')).toBe(true);
  });

  it('rejeita coordenadas ausentes', async () => {
    const errors = await validateInput({});
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });

  it('rejeita coordenadas não numéricas', async () => {
    const errors = await validateInput({ latitude: 'abc', longitude: 'xyz' });
    expect(errors.some((error) => error.property === 'latitude')).toBe(true);
    expect(errors.some((error) => error.property === 'longitude')).toBe(true);
  });
});
