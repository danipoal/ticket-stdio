import {
  breakdown, initials, LineRow, monthDelta, monthlySpend, recentSheets, SheetRow,
  sheetTotal, spendByCategory, spendByProject, summarize,
} from '../dashboard';

const st = (id: number) => ({ id, name: ['', 'Pendiente', 'Aprobado', 'Rechazado'][id] });
const sheet = (id: number, total: string | number | null, status: number | null, extra: Partial<SheetRow> = {}): SheetRow => ({
  id, title: 'H' + id, total_amount: total, status: status ? st(status) : null, create_date: '2026-03-10', ...extra,
});

describe('summarize', () => {
  it('cuenta por estado e importes', () => {
    const r = summarize([sheet(1, '100.50', 2), sheet(2, '50', 1), sheet(3, 20, 3), sheet(4, '30,5', 2)]);
    expect(r).toMatchObject({ count: 4, approved: 2, pending: 1, rejected: 1 });
    expect(r.totalAmount).toBeCloseTo(201);
    expect(r.approvedAmount).toBeCloseTo(131);
    expect(r.pendingAmount).toBe(50);
    expect(r.rejectedAmount).toBe(20);
    expect(r.averageSheet).toBeCloseTo(50.25);
  });
  it('vacio -> todo a 0 sin NaN', () => {
    const r = summarize([]);
    expect(r.averageSheet).toBe(0);
    expect(r.totalAmount).toBe(0);
  });
  it('sin estado cuenta como pendiente; total nulo o basura = 0', () => {
    const r = summarize([sheet(1, null, null), sheet(2, 'abc', 1)]);
    expect(r.pending).toBe(2);
    expect(r.totalAmount).toBe(0);
    expect(sheetTotal(sheet(3, undefined as any, 1))).toBe(0);
  });
});

describe('monthlySpend', () => {
  const now = new Date(2026, 10, 18); // 18 nov 2026
  it('devuelve N meses terminando en el actual, aunque este vacio', () => {
    const p = monthlySpend([], [], now, 8);
    expect(p).toHaveLength(8);
    expect(p[0].key).toBe('2026-04');
    expect(p[7].key).toBe('2026-11');
    expect(p.every((x) => x.value === 0)).toBe(true);
  });
  it('cruza el cambio de año', () => {
    const p = monthlySpend([], [], new Date(2026, 1, 5), 4);
    expect(p.map((x) => x.key)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });
  it('suma por fecha de linea; sin fecha usa la de la hoja; ignora fuera de rango', () => {
    const sheets = [sheet(1, 0, 2, { create_date: '2026-10-20T10:00:00Z' })];
    const lines: LineRow[] = [
      { id_sheet: 1, amount: 10.5, date: '2026-11-01' },
      { id_sheet: 1, amount: '4,5', date: '2026-11-30' },
      { id_sheet: 1, amount: 20, date: null },
      { id_sheet: 2, amount: 999, date: '2020-01-01' },
      { id_sheet: 2, amount: 5, date: 'basura' },
    ];
    const p = monthlySpend(lines, sheets, now, 8);
    expect(p.find((x) => x.key === '2026-11')!.value).toBe(15);
    expect(p.find((x) => x.key === '2026-10')!.value).toBe(20);
    expect(p.reduce((a, x) => a + x.value, 0)).toBe(35);
  });
  it('la fecha YYYY-MM-DD no se desplaza de mes por la zona horaria', () => {
    const p = monthlySpend([{ id_sheet: 1, amount: 1, date: '2026-11-01' }], [], now, 2);
    expect(p[1].value).toBe(1);
  });
  it('etiquetas de mes en castellano, sin punto', () => {
    const p = monthlySpend([], [], now, 8);
    expect(p[7].label).toBe('nov');
    expect(p.every((x) => !x.label.includes('.'))).toBe(true);
  });
});

describe('breakdown / spendByCategory', () => {
  const lines: LineRow[] = [
    { id_sheet: 1, amount: 100, id_category: 1 },
    { id_sheet: 1, amount: 50, id_category: 2 },
    { id_sheet: 1, amount: 50, id_category: 1 },
    { id_sheet: 1, amount: 25, id_category: null },
    { id_sheet: 1, amount: 0, id_category: 3 },
  ];
  const names = { '1': 'Comidas', '2': 'Transporte' };
  it('ordena desc, calcula cuotas que suman 1 y descarta importes 0', () => {
    const r = spendByCategory(lines, names);
    expect(r.map((x) => x.label)).toEqual(['Comidas', 'Transporte', 'Sin categoría']);
    expect(r[0].value).toBe(150);
    expect(r.reduce((a, x) => a + x.share, 0)).toBeCloseTo(1);
  });
  it('agrupa en "Otros" lo que pasa del top', () => {
    const many: LineRow[] = Array.from({ length: 8 }, (_, i) => ({ id_sheet: 1, amount: 10 + i, id_category: i }));
    const r = breakdown(many, (l) => l.id_category, {}, 3);
    expect(r).toHaveLength(4);
    expect(r[3].label).toBe('Otros');
    expect(r.reduce((a, x) => a + x.value, 0)).toBe(many.reduce((a, l) => a + Number(l.amount), 0));
  });
  it('categoria desconocida -> #id; sin lineas -> []', () => {
    expect(spendByCategory([{ id_sheet: 1, amount: 5, id_category: 9 }], {})[0].label).toBe('#9');
    expect(spendByCategory([], names)).toEqual([]);
  });
});

describe('spendByProject / recentSheets / monthDelta / initials', () => {
  it('agrupa por proyecto y tolera vacios', () => {
    const r = spendByProject([
      sheet(1, 100, 2, { project: 'Alfa' }), sheet(2, 50, 1, { project: ' Alfa ' }),
      sheet(3, 30, 1, { project: '' }), sheet(4, 0, 1, { project: 'Cero' }),
    ]);
    expect(r.map((x) => [x.label, x.value])).toEqual([['Alfa', 150], ['Sin proyecto', 30]]);
  });
  it('recentSheets ordena por fecha desc, no muta y tolera fechas rotas', () => {
    const input = [sheet(1, 1, 1, { create_date: '2026-01-01' }), sheet(2, 1, 1, { create_date: '2026-06-01' }), sheet(3, 1, 1, { create_date: null })];
    const r = recentSheets(input, 2);
    expect(r.map((x) => x.id)).toEqual([2, 1]);
    expect(input.map((x) => x.id)).toEqual([1, 2, 3]);
  });
  it('monthDelta', () => {
    expect(monthDelta([{ key: 'a', label: 'a', value: 100 }, { key: 'b', label: 'b', value: 150 }])).toBeCloseTo(0.5);
    expect(monthDelta([{ key: 'a', label: 'a', value: 0 }, { key: 'b', label: 'b', value: 10 }])).toBeNull();
    expect(monthDelta([{ key: 'a', label: 'a', value: 10 }])).toBeNull();
  });
  it('initials', () => {
    expect(initials('Ana Pérez')).toBe('AP');
    expect(initials('  luis   gómez ruiz ')).toBe('LR');
    expect(initials('Marta')).toBe('M');
    expect(initials('')).toBe('?');
    expect(initials(null)).toBe('?');
  });
});
