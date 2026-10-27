import { NumericTransformer } from './numeric.transformer';

describe('NumericTransformer', () => {
  it('should return the same value in "to"', () => {
    expect(NumericTransformer.to(12.34)).toBe(12.34);
    expect(NumericTransformer.to(null)).toBeNull();
    expect(NumericTransformer.to(undefined)).toBeUndefined();
  });

  it('should convert string to number in "from" or keep null/undefined', () => {
    expect(NumericTransformer.from('45.67')).toBe(45.67);
    expect(NumericTransformer.from('0')).toBe(0);
    expect(NumericTransformer.from(null)).toBeNull();
    expect(NumericTransformer.from(undefined)).toBeUndefined();
  });
});
