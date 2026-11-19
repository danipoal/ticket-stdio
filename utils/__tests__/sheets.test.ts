import { canDeleteSheet, filterSheets, statusCounts } from '../sheets';

const s = (id: number, title: string, project: string, status: number | null, description = ''): any => ({
  id, title, project, description, status: status ? { id: status, name: 'x' } : null,
});
const data = [
  s(1, 'Viaje Madrid', 'Alfa', 1),
  s(2, 'Formación React', 'Beta', 2, 'Curso intensivo'),
  s(3, 'Cena proyecto', 'Alfa', 3),
  s(4, 'Sin estado', 'Gamma', null),
];

describe('filterSheets', () => {
  it('sin filtros devuelve todo', () => {
    expect(filterSheets(data, { query: '', status: 'all' })).toHaveLength(4);
    expect(filterSheets(data, { query: '   ', status: 'all' })).toHaveLength(4);
  });
  it('busca sin acentos ni mayusculas en titulo, proyecto y descripcion', () => {
    expect(filterSheets(data, { query: 'formacion', status: 'all' }).map((x) => x.id)).toEqual([2]);
    expect(filterSheets(data, { query: 'ALFA', status: 'all' }).map((x) => x.id)).toEqual([1, 3]);
    expect(filterSheets(data, { query: 'intensivo', status: 'all' }).map((x) => x.id)).toEqual([2]);
  });
  it('filtra por estado; sin estado cuenta como pendiente', () => {
    expect(filterSheets(data, { query: '', status: 1 }).map((x) => x.id)).toEqual([1, 4]);
    expect(filterSheets(data, { query: '', status: 2 }).map((x) => x.id)).toEqual([2]);
  });
  it('combina texto y estado', () => {
    expect(filterSheets(data, { query: 'alfa', status: 3 }).map((x) => x.id)).toEqual([3]);
    expect(filterSheets(data, { query: 'alfa', status: 2 })).toEqual([]);
  });
  it('no usa regex: caracteres especiales no rompen', () => {
    expect(filterSheets(data, { query: '(', status: 'all' })).toEqual([]);
    expect(filterSheets(data, { query: '.*', status: 'all' })).toEqual([]);
  });
});

describe('statusCounts', () => {
  it('cuenta por estado y total', () => {
    expect(statusCounts(data)).toEqual({ all: 4, 1: 2, 2: 1, 3: 1 });
    expect(statusCounts([])).toEqual({ all: 0, 1: 0, 2: 0, 3: 0 });
  });
});

describe('canDeleteSheet', () => {
  it('pendiente y rechazada se pueden borrar; aprobada no (definitiva)', () => {
    expect(canDeleteSheet({ status: { id: 1 } })).toBe(true);
    expect(canDeleteSheet({ status: { id: 3 } })).toBe(true);
    expect(canDeleteSheet({ status: { id: 2 } })).toBe(false);
  });
  it('sin estado cuenta como pendiente', () => {
    expect(canDeleteSheet({})).toBe(true);
    expect(canDeleteSheet({ status: null })).toBe(true);
  });
});
