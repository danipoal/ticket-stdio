/**
 * Convierte texto escrito por un usuario en un numero.
 * Acepta coma o punto decimal ("12,50" y "12.50") y separador de miles
 * ("1.234,56" / "1,234.56"). Devuelve null si esta vacio o no es un numero.
 *
 * Importante: Number("12,50") es NaN y JSON.stringify(NaN) es null, asi que
 * antes un importe con coma se guardaba como NULL sin avisar.
 */
export function parseDecimal(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') return Number.isFinite(input) ? input : null;

  let s = input.trim().replace(/\s+/g, '');
  if (s === '') return null;

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma !== -1 && lastDot !== -1) {
    // El ultimo separador es el decimal; el otro es de miles.
    const decimalSep = lastComma > lastDot ? ',' : '.';
    const thousandsSep = decimalSep === ',' ? '.' : ',';
    s = s.split(thousandsSep).join('').replace(decimalSep, '.');
  } else if (lastComma !== -1) {
    // Una sola coma: decimal. Varias comas: miles ("1,234,567").
    s = s.indexOf(',') === lastComma ? s.replace(',', '.') : s.split(',').join('');
  }

  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** true si es una fecha real YYYY-MM-DD (rechaza 2025-02-30, 2025-13-01...). */
export function isValidIsoDate(value: string | null | undefined): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
  );
}

/** Fecha local legible, o "-" si falta o no es valida (antes: "Invalid Date"). */
export function formatDateSafe(value: string | null | undefined): string {
  if (!value) return '-';
  const d = new Date(value);
  // Siempre en castellano (dia/mes/año): sin locale explicito dependia del idioma del navegador o de la maquina (en CI salia 1/15/2027)
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('es-ES');
}

/** Importe con 2 decimales y coma/punto segun el locale. null/NaN -> 0,00. */
export function formatAmount(value: number | string | null | undefined): string {
  const n = typeof value === 'string' ? parseDecimal(value) : value;
  const safe = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  // useGrouping 'always': en es-ES un numero de 4 cifras (2662,34) no lleva separador de miles por defecto
  return safe.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' as any });
}

export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Fecha y hora local legible (historial), o "-" si falta o no es valida. */
export function formatDateTimeSafe(value: string | null | undefined): string {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** "1 hoja" / "3 hojas" (el 1 va en singular). `plural(1, 'línea registrada', 'líneas registradas')`. */
export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
