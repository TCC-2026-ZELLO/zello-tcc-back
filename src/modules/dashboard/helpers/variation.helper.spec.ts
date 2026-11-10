import { percentOf, round2, variationPercent } from './variation.helper';

describe('variation.helper', () => {
  describe('variationPercent', () => {
    it('calcula crescimento e queda', () => {
      expect(variationPercent(150, 100)).toBe(50);
      expect(variationPercent(75, 100)).toBe(-25);
      expect(variationPercent(0, 100)).toBe(-100);
    });

    it('retorna null quando o período anterior é 0 (sem base de comparação)', () => {
      expect(variationPercent(100, 0)).toBeNull();
      expect(variationPercent(0, 0)).toBeNull();
    });

    it('arredonda para 2 casas', () => {
      expect(variationPercent(100, 30)).toBe(233.33);
    });
  });

  describe('percentOf', () => {
    it('calcula participação percentual', () => {
      expect(percentOf(1, 3)).toBe(33.33);
      expect(percentOf(50, 50)).toBe(100);
    });

    it('retorna null para total 0', () => {
      expect(percentOf(0, 0)).toBeNull();
    });
  });

  describe('round2', () => {
    it('arredonda valores monetários', () => {
      expect(round2(1.005)).toBe(1.01);
      expect(round2(10)).toBe(10);
    });
  });
});
