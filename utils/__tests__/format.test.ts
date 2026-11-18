import { formatAmount, formatDateSafe, isValidIsoDate, parseDecimal, todayIso } from '../format';

describe('parseDecimal', () => {
  it.each([
    ['12', 12],
    ['12.5', 12.5],
    ['12,5', 12.5],
    ['12,50', 12.5],
    ['0,99', 0.99],
    ['  7,25  ', 7.25],
    ['1.234,56', 1234.56],
    ['1,234.56', 1234.56],
    ['1,234,567', 1234567],
    ['1 234,5', 1234.5],
    ['-3,5', -3.5],
    ['0', 0],
  ])('"%s" -> %p', (input, expected) => {
    expect(parseDecimal(input)).toBe(expected);
  });

  it.each(['', '   ', 'abc', '12a', '1,2,3x', '--1', '1..2', ',', '.', '12,', 'NaN', 'Infinity'])(
    'rechaza "%s"',
    (input) => {
      expect(parseDecimal(input)).toBeNull();
    }
  );

  it('maneja null, undefined y numeros', () => {
    expect(parseDecimal(null)).toBeNull();
    expect(parseDecimal(undefined)).toBeNull();
    expect(parseDecimal(5)).toBe(5);
    expect(parseDecimal(NaN)).toBeNull();
    expect(parseDecimal(Infinity)).toBeNull();
  });

  it('regresion: Number("12,50") es NaN, parseDecimal no', () => {
    expect(Number('12,50')).toBeNaN();
    expect(parseDecimal('12,50')).toBe(12.5);
  });
});

describe('isValidIsoDate', () => {
  it.each(['2025-01-31', '2024-02-29', '2000-12-01'])('%s valida', (d) => {
    expect(isValidIsoDate(d)).toBe(true);
  });
  it.each(['2025-02-30', '2023-02-29', '2025-13-01', '2025-00-10', '2025-1-1', '31/01/2025', '', 'hoy'])(
    '%s invalida',
    (d) => {
      expect(isValidIsoDate(d)).toBe(false);
    }
  );
  it('null y undefined son invalidas', () => {
    expect(isValidIsoDate(null)).toBe(false);
    expect(isValidIsoDate(undefined)).toBe(false);
  });
});

describe('formatDateSafe', () => {
  it('no devuelve "Invalid Date"', () => {
    expect(formatDateSafe(null)).toBe('-');
    expect(formatDateSafe(undefined)).toBe('-');
    expect(formatDateSafe('')).toBe('-');
    expect(formatDateSafe('basura')).toBe('-');
  });
  it('formatea fechas validas', () => {
    expect(formatDateSafe('2025-03-04')).not.toBe('-');
    expect(formatDateSafe('2025-03-04T10:00:00Z')).not.toBe('-');
  });
});

describe('formatAmount', () => {
  it('siempre 2 decimales y nunca NaN', () => {
    expect(formatAmount(12.5)).toMatch(/12,50/);
    expect(formatAmount(null)).toMatch(/0,00/);
    expect(formatAmount(undefined)).toMatch(/0,00/);
    expect(formatAmount('abc')).toMatch(/0,00/);
    expect(formatAmount('7,5')).toMatch(/7,50/);
    expect(formatAmount(NaN)).not.toMatch(/NaN/);
  });
});

describe('todayIso', () => {
  it('usa la fecha local, no UTC', () => {
    expect(todayIso(new Date(2025, 0, 5, 23, 59))).toBe('2025-01-05');
    expect(todayIso(new Date(2025, 11, 31, 0, 0))).toBe('2025-12-31');
  });
});

describe('formatAmount: separador de miles', () => {
  it('agrupa miles tambien en 4 cifras (2.662,34, no 2662,34)', () => {
    expect(formatAmount(2662.34)).toBe('2.662,34');
    expect(formatAmount(1234567.5)).toBe('1.234.567,50');
    expect(formatAmount(999.99)).toBe('999,99');
  });
});
