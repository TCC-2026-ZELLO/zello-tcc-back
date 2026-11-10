import { validate } from 'class-validator';
import { IsCpf } from './is-cpf.validator';

class TestDto {
  @IsCpf()
  cpf: string;
}

describe('IsCpf Validator', () => {
  let dto: TestDto;

  beforeEach(() => {
    dto = new TestDto();
  });

  it('should validate a correct CPF', async () => {
    dto.cpf = '01234567890'; // Replace with a valid mock CPF for tests if needed, or just standard 11 digits that pass the mod11. Let's use a known valid one or mock one. Actually, '01234567890' is invalid. Let's use '52998224725' (gerador)
    dto.cpf = '52998224725';
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should format and validate CPF with punctuation', async () => {
    dto.cpf = '529.982.247-25';
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail on invalid check digits', async () => {
    dto.cpf = '52998224726';
    const errors = await validate(dto);
    expect(errors.length).toBe(1);
    expect(errors[0].constraints?.isCpf).toBe('CPF inválido.');
  });

  it('should fail on all-same digits', async () => {
    dto.cpf = '11111111111';
    const errors = await validate(dto);
    expect(errors.length).toBe(1);
  });

  it('should fail on wrong length', async () => {
    dto.cpf = '123';
    const errors = await validate(dto);
    expect(errors.length).toBe(1);
  });
});
