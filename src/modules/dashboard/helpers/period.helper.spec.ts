import {
  addDays,
  countDaysInclusive,
  isIsoDate,
  listDays,
  resolvePeriod,
  validatePeriod,
} from './period.helper';

describe('period.helper', () => {
  describe('isIsoDate', () => {
    it('aceita datas de calendário reais em YYYY-MM-DD', () => {
      expect(isIsoDate('2026-10-01')).toBe(true);
      expect(isIsoDate('2024-02-29')).toBe(true);
    });

    it('rejeita formatos e datas inexistentes', () => {
      expect(isIsoDate('2026-02-30')).toBe(false);
      expect(isIsoDate('2025-02-29')).toBe(false);
      expect(isIsoDate('01/10/2026')).toBe(false);
      expect(isIsoDate('2026-10-01T00:00:00Z')).toBe(false);
      expect(isIsoDate(undefined)).toBe(false);
      expect(isIsoDate(20261001)).toBe(false);
    });
  });

  describe('resolvePeriod', () => {
    it('calcula o período anterior com a mesma duração, terminando antes de from', () => {
      expect(resolvePeriod('2026-10-01', '2026-10-31')).toEqual({
        from: '2026-10-01',
        to: '2026-10-31',
        previousFrom: '2026-08-31',
        previousTo: '2026-09-30',
      });
    });

    it('trata período de um único dia', () => {
      expect(resolvePeriod('2026-03-01', '2026-03-01')).toEqual({
        from: '2026-03-01',
        to: '2026-03-01',
        previousFrom: '2026-02-28',
        previousTo: '2026-02-28',
      });
    });

    it('atravessa a virada de ano', () => {
      const period = resolvePeriod('2026-01-01', '2026-01-10');
      expect(period.previousFrom).toBe('2025-12-22');
      expect(period.previousTo).toBe('2025-12-31');
    });
  });

  describe('listDays / countDaysInclusive / addDays', () => {
    it('lista cada dia do período, inclusivo', () => {
      expect(listDays('2026-02-27', '2026-03-02')).toEqual([
        '2026-02-27',
        '2026-02-28',
        '2026-03-01',
        '2026-03-02',
      ]);
      expect(countDaysInclusive('2026-02-27', '2026-03-02')).toBe(4);
    });

    it('retorna lista vazia para intervalo invertido', () => {
      expect(listDays('2026-03-02', '2026-03-01')).toEqual([]);
    });

    it('soma e subtrai dias', () => {
      expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
      expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    });
  });

  describe('validatePeriod', () => {
    it('aceita intervalo válido, inclusive no limite máximo', () => {
      expect(validatePeriod('2026-01-01', '2026-01-01', 366)).toBeNull();
      expect(validatePeriod('2024-01-01', '2024-12-31', 366)).toBeNull();
    });

    it('rejeita from ou to inválidos', () => {
      expect(validatePeriod('2026-13-01', '2026-01-10', 366)).toContain(
        'data inicial',
      );
      expect(validatePeriod('2026-01-01', 'abc', 366)).toContain('data final');
    });

    it('rejeita to anterior a from', () => {
      expect(validatePeriod('2026-01-10', '2026-01-09', 366)).toBe(
        'A data final (to) deve ser maior ou igual à data inicial (from).',
      );
    });

    it('rejeita intervalo acima do máximo', () => {
      expect(validatePeriod('2025-01-01', '2026-01-02', 366)).toBe(
        'O período selecionado deve ter no máximo 366 dias.',
      );
    });
  });
});
