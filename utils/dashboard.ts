import { SheetStatusID } from '@/constants/constants';
import { parseDecimal } from './format';

export type SheetRow = {
  id: number;
  title: string;
  project?: string | null;
  total_amount?: string | number | null;
  create_date?: string | null;
  status?: { id: number; name: string } | null;
};

export type LineRow = {
  id?: number;
  id_sheet: string | number;
  amount?: number | string | null;
  date?: string | null;
  id_category?: string | number | null;
  id_payment_type?: string | number | null;
};

const num = (v: unknown): number => {
  const n = parseDecimal(v as any);
  return n ?? 0;
};

export const sheetTotal = (s: SheetRow) => num(s.total_amount);

export type Summary = {
  count: number;
  approved: number;
  pending: number;
  rejected: number;
  totalAmount: number;
  approvedAmount: number;
  pendingAmount: number;
  rejectedAmount: number;
  averageSheet: number;
};

export function summarize(sheets: SheetRow[]): Summary {
  const s: Summary = {
    count: sheets.length, approved: 0, pending: 0, rejected: 0,
    totalAmount: 0, approvedAmount: 0, pendingAmount: 0, rejectedAmount: 0, averageSheet: 0,
  };
  for (const sheet of sheets) {
    const t = sheetTotal(sheet);
    s.totalAmount += t;
    switch (sheet.status?.id) {
      case SheetStatusID.APROBADO: s.approved++; s.approvedAmount += t; break;
      case SheetStatusID.RECHAZADO: s.rejected++; s.rejectedAmount += t; break;
      default: s.pending++; s.pendingAmount += t; // sin estado cuenta como pendiente
    }
  }
  s.averageSheet = s.count ? s.totalAmount / s.count : 0;
  return s;
}

export type MonthPoint = { key: string; label: string; value: number };

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

function parseDate(v?: string | null): Date | null {
  if (!v) return null;
  // YYYY-MM-DD se interpreta como fecha local (new Date('2025-03-01') es UTC y puede caer en febrero)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Gasto por mes de los ultimos `months` meses (incluido el actual, aunque este a 0).
 * Cada linea cuenta en el mes de su fecha; si no tiene, en el de creacion de su hoja.
 */
export function monthlySpend(
  lines: LineRow[],
  sheets: SheetRow[],
  now: Date = new Date(),
  months = 8
): MonthPoint[] {
  const points: MonthPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    points.push({
      key: monthKey(d),
      label: d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', ''),
      value: 0,
    });
  }
  const byKey = new Map(points.map((p) => [p.key, p]));
  const sheetDate = new Map(sheets.map((s) => [String(s.id), s.create_date]));
  for (const l of lines) {
    const d = parseDate(l.date) ?? parseDate(sheetDate.get(String(l.id_sheet)));
    if (!d) continue;
    const p = byKey.get(monthKey(d));
    if (p) p.value += num(l.amount);
  }
  for (const p of points) p.value = Math.round(p.value * 100) / 100;
  return points;
}

export type Slice = { id: string; label: string; value: number; share: number };

/** Reparto por clave (categoria, pago...) ordenado desc; lo que pasa de `top` se agrupa en "Otros". */
export function breakdown(
  lines: LineRow[],
  pick: (l: LineRow) => string | number | null | undefined,
  names: Record<string, string>,
  top = 5
): Slice[] {
  const totals = new Map<string, number>();
  for (const l of lines) {
    const k = pick(l);
    const key = k === null || k === undefined || k === '' ? '__none' : String(k);
    totals.set(key, (totals.get(key) ?? 0) + num(l.amount));
  }
  const all = [...totals.entries()]
    .map(([id, value]) => ({ id, value, label: id === '__none' ? 'Sin categoría' : names[id] ?? `#${id}` }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value);
  const sum = all.reduce((a, x) => a + x.value, 0);
  let list = all;
  if (all.length > top) {
    const rest = all.slice(top).reduce((a, x) => a + x.value, 0);
    list = [...all.slice(0, top), { id: '__others', label: 'Otros', value: rest }];
  }
  return list.map((x) => ({
    ...x,
    value: Math.round(x.value * 100) / 100,
    share: sum ? x.value / sum : 0,
  }));
}

export const spendByCategory = (lines: LineRow[], names: Record<string, string>, top = 5) =>
  breakdown(lines, (l) => l.id_category, names, top);

export function spendByProject(sheets: SheetRow[], top = 5): Slice[] {
  const totals = new Map<string, number>();
  for (const s of sheets) {
    const k = (s.project ?? '').trim() || 'Sin proyecto';
    totals.set(k, (totals.get(k) ?? 0) + sheetTotal(s));
  }
  const all = [...totals.entries()].map(([label, value]) => ({ id: label, label, value })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
  const sum = all.reduce((a, x) => a + x.value, 0);
  return all.slice(0, top).map((x) => ({ ...x, value: Math.round(x.value * 100) / 100, share: sum ? x.value / sum : 0 }));
}

export function recentSheets(sheets: SheetRow[], n = 5): SheetRow[] {
  const time = (s: SheetRow) => parseDate(s.create_date)?.getTime() ?? 0;
  return [...sheets].sort((a, b) => time(b) - time(a)).slice(0, n);
}

/** Variacion % del ultimo mes frente al anterior, o null si el anterior es 0. */
export function monthDelta(points: MonthPoint[]): number | null {
  if (points.length < 2) return null;
  const cur = points[points.length - 1].value;
  const prev = points[points.length - 2].value;
  if (prev === 0) return null;
  return (cur - prev) / prev;
}

export function initials(name?: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
