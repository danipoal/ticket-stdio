import * as React from 'react';
import { act } from 'react-test-renderer';
import { flush, mount, press, text, type } from '../test-utils/render';
import { db } from '../test-utils/supabaseMock';

let mockWidth = 1440;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 900, scale: 1, fontScale: 1 }),
}));
jest.mock('@/utils/supabase', () => ({ supabase: require('../test-utils/supabaseMock').db.client }));
let mockEmployee: any = { id: 'admin1', name: 'Marta Ruiz', is_admin: true };
jest.mock('@/context/useAuth', () => () => ({ employee: mockEmployee }));
jest.mock('@/context/useAux', () => () => ({ paymentTypes: [], categories: [], sheetStatuses: [] }));
const mockConfirm = jest.fn();
jest.mock('@/utils/confirm', () => ({ confirmAction: (...a: any[]) => mockConfirm(...a) }));
jest.mock('expo-file-system', () => ({}));
jest.mock('expo-sharing', () => ({}));
jest.mock('expo-image-picker', () => ({ MediaTypeOptions: { Images: 'Images' } }));
jest.mock('expo-web-browser', () => ({}));

import ApprovalsScreen from '@/app/(tabs)/approvals';

const row = (id: number, title: string, owner: string, statusId: number): any => ({
  id, title, description: '', project: 'Alfa', total_amount: String(id * 10), create_date: `2026-03-0${id}`,
  approval_date: '', id_user: owner, status: { id: statusId, name: ['', 'Pendiente', 'Aprobado', 'Rechazado'][statusId] },
});
const sheets = [
  row(1, 'Viaje Madrid', 'e1', 1),
  row(2, 'Formación React', 'e2', 1),
  row(3, 'Cena equipo', 'e1', 2),
  row(4, 'Taxi', 'admin1', 1),
  row(5, 'Hotel', 'e2', 3),
];
const items = (r: any) => r.root.findAll((n: any) => n.props.testID === 'sheet-open' && typeof n.type === 'string').length;

describe('ApprovalsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.reset();
    mockWidth = 1440;
    mockEmployee = { id: 'admin1', name: 'Marta Ruiz', is_admin: true };
    db.on('expense_sheet_with_total', 'select', { data: sheets });
    db.on('employees', 'select', { data: [{ id: 'e1', name: 'Ana Pérez' }, { id: 'e2', name: 'Luis Gómez' }, { id: 'admin1', name: 'Marta Ruiz' }] });
    db.on('Expense_line', 'select', { data: [{ id: 7, title: 'Taxi', amount: 12.5, tax: 21, date: '2026-03-02', id_category: '2', id_payment_type: '1' }] });
  });

  it('un no-admin ve el area restringida y no consulta nada (defensa en cliente; RLS es la barrera real)', async () => {
    mockEmployee = { id: 'e1', is_admin: false };
    const r = await mount(<ApprovalsScreen />);
    expect(text(r.root)).toContain('Área restringida');
    expect(db.calls).toHaveLength(0);
  });

  it('por defecto muestra solo las pendientes, con el nombre de quien las presenta ("Tú" para las propias)', async () => {
    const r = await mount(<ApprovalsScreen />);
    expect(items(r)).toBe(3);
    const t = text(r.root);
    expect(t).toContain('Ana Pérez');
    expect(t).toContain('Luis Gómez');
    expect(t).toContain('Tú');
    expect(t).toContain('3 hojas pendientes de aprobar');
    expect(t).not.toContain('Cena equipo'); // aprobada
  });

  it('los chips muestran contadores y filtran por estado', async () => {
    const r = await mount(<ApprovalsScreen />);
    expect(text(r.root)).toMatch(/Pendientes\s*3/);
    expect(text(r.root)).toMatch(/Aprobadas\s*1/);
    await press(r.root, 'appr-filter-3');
    expect(items(r)).toBe(1);
    expect(text(r.root)).toContain('Hotel');
    await press(r.root, 'appr-filter-all');
    expect(items(r)).toBe(5);
  });

  it('la busqueda incluye el nombre de la persona', async () => {
    const r = await mount(<ApprovalsScreen />);
    await press(r.root, 'appr-filter-all');
    await type(r.root, 'approvals-search', 'luis');
    expect(items(r)).toBe(2);
    await type(r.root, 'approvals-search', 'zzz');
    expect(items(r)).toBe(0);
    expect(text(r.root)).toContain('Ninguna hoja coincide');
  });

  it('no ofrece borrar hojas ajenas', async () => {
    const r = await mount(<ApprovalsScreen />);
    expect(r.root.findAll((n) => n.props.testID === 'sheet-delete')).toHaveLength(0);
  });

  it('abrir una pendiente muestra sus lineas en solo lectura y los botones Aprobar/Rechazar con texto', async () => {
    const r = await mount(<ApprovalsScreen />);
    await press(r.root, 'sheet-open');
    const t = text(r.root);
    expect(t).toContain('Aprobar');
    expect(t).toContain('Rechazar');
    expect(r.root.findAll((n) => n.props.testID === 'add-line')).toHaveLength(0);
    expect(r.root.findAll((n) => n.props.testID === 'delete-line-7')).toHaveLength(0);
  });

  it('aprobar envia id_status 2 SIN tocar approval_date (lo fija la base de datos) y refresca', async () => {
    let approved = false;
    db.on('expense_sheet_with_total', 'select', () => ({ data: sheets.map((s) => (s.id === 1 && approved ? row(1, 'Viaje Madrid', 'e1', 2) : s)) }));
    db.on('Expense_sheet', 'update', () => ((approved = true), { data: null }));
    const r = await mount(<ApprovalsScreen />);
    await press(r.root, 'sheet-open');
    const before = db.calls.filter((c) => c.table === 'expense_sheet_with_total').length;
    await press(r.root, 'approve-sheet');
    await act(async () => {});
    await flush();
    const upd = db.calls.find((c) => c.op === 'update');
    expect(upd?.payload).toEqual({ id_status: '2' });
    expect(upd?.filters).toEqual([['id', 1]]);
    expect(db.calls.filter((c) => c.table === 'expense_sheet_with_total').length).toBeGreaterThan(before);
    // ya no hay botones (hoja aprobada) y el contador baja a 2
    expect(r.root.findAll((n) => n.props.testID === 'approve-sheet')).toHaveLength(0);
    expect(text(r.root)).toContain('2 hojas pendientes de aprobar');
  });

  it('rechazar envia id_status 3', async () => {
    db.on('Expense_sheet', 'update', { data: null });
    const r = await mount(<ApprovalsScreen />);
    await press(r.root, 'sheet-open');
    await press(r.root, 'reject-sheet');
    expect(db.calls.find((c) => c.op === 'update')?.payload).toEqual({ id_status: '3' });
  });

  it('si la base de datos rechaza la operacion (sin permiso) se avisa y la hoja sigue pendiente', async () => {
    db.on('Expense_sheet', 'update', { error: { message: 'Transicion de estado no permitida (1 -> 2)' } });
    const r = await mount(<ApprovalsScreen />);
    await press(r.root, 'sheet-open');
    await press(r.root, 'approve-sheet');
    expect(text(r.root)).toContain('No se pudo actualizar el estado');
    expect(r.root.findAll((n) => n.props.testID === 'approve-sheet').length).toBeGreaterThan(0);
  });

  it('error al cargar -> mensaje; sin hojas -> mensaje', async () => {
    db.on('expense_sheet_with_total', 'select', { error: { message: 'x' } });
    let r = await mount(<ApprovalsScreen />);
    expect(text(r.root)).toContain('Error cargando las hojas');
    db.on('expense_sheet_with_total', 'select', { data: [] });
    r = await mount(<ApprovalsScreen />);
    expect(text(r.root)).toContain('No hay hojas que revisar');
  });

  it('sin pendientes: mensaje especifico', async () => {
    db.on('expense_sheet_with_total', 'select', { data: [row(3, 'Cena equipo', 'e1', 2)] });
    const r = await mount(<ApprovalsScreen />);
    expect(text(r.root)).toContain('No tienes hojas pendientes de aprobar');
  });

  it('movil: lista; al abrir una hoja se ve el detalle a pantalla completa', async () => {
    mockWidth = 390;
    const r = await mount(<ApprovalsScreen />);
    expect(items(r)).toBe(3);
    await press(r.root, 'sheet-open');
    expect(r.root.findAll((n) => n.props.testID === 'approve-sheet').length).toBeGreaterThan(0);
    expect(items(r)).toBe(0); // la lista se oculta mientras se revisa
  });
});
