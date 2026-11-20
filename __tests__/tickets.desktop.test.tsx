import * as React from 'react';
import { act } from 'react-test-renderer';
import { flush, mount, press, text, type } from '../test-utils/render';
import { db } from '../test-utils/supabaseMock';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 1440, height: 900, scale: 1, fontScale: 1 }),
}));
jest.mock('@/utils/supabase', () => ({ supabase: require('../test-utils/supabaseMock').db.client }));
jest.mock('@/context/useAuth', () => () => ({ employee: { id: 'e1', is_admin: false } }));
jest.mock('@/context/useAux', () => () => ({
  paymentTypes: [{ id: 1, name: 'Tarjeta' }], categories: [{ id: 2, name: 'Comidas' }], sheetStatuses: [],
}));
const mockConfirm = jest.fn();
jest.mock('@/utils/confirm', () => ({ confirmAction: (...a: any[]) => mockConfirm(...a) }));
jest.mock('expo-file-system', () => ({}));
jest.mock('expo-sharing', () => ({}));
jest.mock('expo-image-picker', () => ({ MediaTypeOptions: { Images: 'Images' } }));
jest.mock('expo-web-browser', () => ({}));

import TicketsScreen from '@/app/(tabs)/tickets';

const row = (id: number, title: string, project: string, statusId: number): any => ({
  id, title, description: '', project, total_amount: String(id * 10), create_date: `2026-03-0${id}`,
  approval_date: '', id_user: 'e1', status: { id: statusId, name: ['', 'Pendiente', 'Aprobado', 'Rechazado'][statusId] },
});
const data = [row(1, 'Viaje Madrid', 'Alfa', 1), row(2, 'Formación React', 'Beta', 2), row(3, 'Cena equipo', 'Alfa', 3)];
const titlesShown = (r: any) =>
  r.root.findAll((n: any) => n.props.testID === 'sheet-open' && typeof n.type === 'string').length;

describe('TicketsScreen en escritorio (maestro-detalle)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.reset();
    mockConfirm.mockResolvedValue(true);
    db.on('expense_sheet_with_total', 'select', { data });
    db.on('Expense_line', 'select', {
      data: [{ id: 7, title: 'Taxi', amount: 12.5, tax: 21, date: '2026-03-02', id_category: '2', id_payment_type: '1', foto: 'https://x/y.jpg' }],
    });
  });

  it('muestra cabecera con contador, boton "Nueva hoja", lista y panel vacio', async () => {
    const r = await mount(<TicketsScreen />);
    const t = text(r.root);
    expect(t).toContain('Mis tickets');
    expect(t).toContain('3 hojas de gasto');
    expect(t).toContain('Nueva hoja');
    expect(t).toContain('Selecciona una hoja');
    expect(titlesShown(r)).toBe(3);
  });

  it('seleccionar una hoja abre el detalle ancho con cabecera, KPIs y tabla de lineas', async () => {
    const r = await mount(<TicketsScreen />);
    await press(r.root, 'sheet-open');
    const t = text(r.root);
    expect(r.root.findAll((n) => n.props.testID === 'sheet-header-wide').length).toBeGreaterThan(0);
    expect(r.root.findAll((n) => n.props.testID === 'lines-table-head').length).toBeGreaterThan(0);
    expect(t).toContain('Taxi');
    expect(t).toContain('Comidas'); // nombre de categoria, no el id
    expect(t).toContain('Tarjeta'); // nombre del tipo de pago
    expect(t).toContain('12,50');
    expect(t).not.toContain('Selecciona una hoja');
  });

  it('el propietario no ve Aprobar/Rechazar; ve el aviso de pendiente de aprobacion', async () => {
    const r = await mount(<TicketsScreen />);
    await press(r.root, 'sheet-open');
    expect(text(r.root)).not.toContain('Aprobar');
    expect(text(r.root)).not.toContain('Rechazar');
    expect(text(r.root)).toContain('Pendiente de aprobación por tu responsable');
  });

  it('la busqueda filtra la lista sin acentos', async () => {
    const r = await mount(<TicketsScreen />);
    await type(r.root, 'sheet-search', 'formacion');
    expect(titlesShown(r)).toBe(1);
    expect(text(r.root)).toContain('Formación React');
    await type(r.root, 'sheet-search', 'zzz');
    expect(titlesShown(r)).toBe(0);
    expect(text(r.root)).toContain('Ninguna hoja coincide');
  });

  it('los chips filtran por estado y muestran contadores', async () => {
    const r = await mount(<TicketsScreen />);
    expect(text(r.root)).toMatch(/Todas\s*3/);
    await press(r.root, 'filter-2');
    expect(titlesShown(r)).toBe(1);
    await press(r.root, 'filter-3');
    expect(text(r.root)).toContain('Cena equipo');
    await press(r.root, 'filter-all');
    expect(titlesShown(r)).toBe(3);
  });

  it('"Nueva hoja" abre el formulario en el panel derecho y deselecciona la hoja', async () => {
    const r = await mount(<TicketsScreen />);
    await press(r.root, 'sheet-open');
    await press(r.root, 'add-button');
    expect(text(r.root)).toContain('Nueva hoja de gastos');
    expect(r.root.findAll((n) => n.props.testID === 'sheet-header-wide')).toHaveLength(0);
  });

  it('REGRESION: el formulario de nueva hoja va en un scroll propio (en ventanas bajas el boton Crear quedaba inalcanzable)', async () => {
    const r = await mount(<TicketsScreen />);
    await press(r.root, 'add-button');
    const scroll = r.root.findAll((n) => n.props.testID === 'create-sheet-scroll');
    expect(scroll.length).toBeGreaterThan(0);
    const crear = scroll[0].findAll((n) => n.props.testID === 'sheet-create');
    expect(crear.length).toBeGreaterThan(0);
  });

  it('borrar desde la lista pide confirmacion y usa el id correcto', async () => {
    db.on('Expense_sheet', 'delete', { data: [{ id: 1 }] });
    const r = await mount(<TicketsScreen />);
    await press(r.root, 'sheet-delete');
    expect(mockConfirm).toHaveBeenCalled();
    expect(db.calls.find((c) => c.op === 'delete')?.filters).toEqual([['id', 1]]);
  });

  it('REGRESION: la hoja aprobada no tiene papelera en la lista de escritorio', async () => {
    const r = await mount(<TicketsScreen />);
    const trashes = r.root.findAll((n) => n.props.testID === 'sheet-delete' && typeof n.type === 'string').length;
    expect(trashes).toBe(2); // pendiente (id 1) y rechazada (id 3); la aprobada (id 2) no
  });

  it('REGRESION: el boton de borrar no esta anidado dentro del boton de abrir (HTML invalido)', async () => {
    const r = await mount(<TicketsScreen />);
    const open = r.root.findAll((n) => n.props.testID === 'sheet-open' && typeof n.props.onPress === 'function')[0];
    expect(open.findAll((n) => n.props.testID === 'sheet-delete')).toHaveLength(0);
  });

  it('sin hojas: mensaje y sin barra de busqueda', async () => {
    db.on('expense_sheet_with_total', 'select', { data: [] });
    const r = await mount(<TicketsScreen />);
    expect(text(r.root)).toContain('No tienes tickets todavía');
    expect(r.root.findAll((n) => n.props.testID === 'sheet-toolbar')).toHaveLength(0);
  });

  it('al reenviar una hoja rechazada, la lista del panel izquierdo se refresca', async () => {
    let resubmitted = false;
    db.on('expense_sheet_with_total', 'select', () => ({
      data: data.map((s) => (s.id === 3 ? { ...s, status: { id: resubmitted ? 1 : 3, name: resubmitted ? 'Pendiente' : 'Rechazado' } } : s)),
    }));
    db.on('Expense_sheet', 'update', () => ((resubmitted = true), { data: null }));
    const r = await mount(<TicketsScreen />);
    await press(r.root, 'filter-3');
    await press(r.root, 'sheet-open');
    await press(r.root, 'resubmit-sheet');
    await act(async () => {});
    await flush();
    expect(db.calls.filter((c) => c.table === 'expense_sheet_with_total').length).toBeGreaterThanOrEqual(2);
    expect(text(r.root)).toContain('Pendiente de aprobación');
  });
});
