import { validate } from 'class-validator';
import { IsCnpj } from './is-cnpj.validator';

class TestDto {
  @IsCnpj()
  cnpj: string;
}

describe('IsCnpj Validator', () => {
  let dto: TestDto;

  beforeEach(() => {
    dto = new TestDto();
  });

  it('should validate a correct CNPJ', async () => {
    dto.cnpj = '11222333000181'; // valid CNPJ
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should format and validate CNPJ with punctuation', async () => {
    dto.cnpj = '11.222.333/0001-81';
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail on invalid check digits', async () => {
    dto.cnpj = '11222333000182';
    const errors = await validate(dto);
    expect(errors.length).toBe(1);
    expect(errors[0].constraints?.isCnpj).toBe('CNPJ inválido.');
  });

  it('should fail on all-same digits', async () => {
    dto.cnpj = '11111111111111';
    const errors = await validate(dto);
    expect(errors.length).toBe(1);
  });

  it('should fail on wrong length', async () => {
    dto.cnpj = '12345';
    const errors = await validate(dto);
    expect(errors.length).toBe(1);
  });
});
