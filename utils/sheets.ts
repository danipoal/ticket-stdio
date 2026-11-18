import { SheetRow } from './dashboard';

export type StatusFilter = 'all' | number;

export type SheetFilter = { query: string; status: StatusFilter };

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Filtra por texto (titulo, proyecto, descripcion; sin acentos ni mayusculas) y por estado. */
export function filterSheets<T extends SheetRow & { description?: string | null }>(sheets: T[], f: SheetFilter): T[] {
  const q = norm(f.query.trim());
  return sheets.filter((s) => {
    if (f.status !== 'all' && (s.status?.id ?? 1) !== f.status) return false;
    if (!q) return true;
    return [s.title, s.project, s.description].some((x) => !!x && norm(String(x)).includes(q));
  });
}

export function statusCounts(sheets: SheetRow[]): Record<'all' | 1 | 2 | 3, number> {
  const c = { all: sheets.length, 1: 0, 2: 0, 3: 0 } as Record<'all' | 1 | 2 | 3, number>;
  for (const s of sheets) {
    const id = (s.status?.id ?? 1) as 1 | 2 | 3;
    if (id in c) c[id]++;
  }
  return c;
}
