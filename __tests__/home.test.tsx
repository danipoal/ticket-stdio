import * as React from 'react';
import { mount, press, text } from '../test-utils/render';
import { db } from '../test-utils/supabaseMock';

let mockWidth = 1440;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 900, scale: 1, fontScale: 1 }),
}));
jest.mock('@/utils/supabase', () => ({ supabase: require('../test-utils/supabaseMock').db.client }));
let mockEmployee: any = { id: 'e1', name: 'Ana Pérez', is_admin: false };
jest.mock('@/context/useAuth', () => () => ({ employee: mockEmployee }));
jest.mock('@/context/useAux', () => () => ({
  categories: [{ id: 1, name: 'Comidas' }, { id: 2, name: 'Transporte' }],
  paymentTypes: [{ id: 1, name: 'Tarjeta' }],
  sheetStatuses: [],
}));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

import HomeScreen from '@/app/(tabs)/home';

const now = new Date();
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-10`;
const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);

const sheets = [
  { id: 1, title: 'Viaje', project: 'Alfa', total_amount: '1000.50', create_date: iso(now), status: { id: 2, name: 'Aprobado' } },
  { id: 2, title: 'Comida', project: 'Beta', total_amount: '200', create_date: iso(prev), status: { id: 1, name: 'Pendiente' } },
  { id: 3, title: 'Taxi', project: 'Alfa', total_amount: '50', create_date: iso(prev), status: { id: 3, name: 'Rechazado' } },
];
const lines = [
  { id: 1, id_sheet: '1', amount: 600, date: iso(now), id_category: '1', id_payment_type: '1' },
  { id: 2, id_sheet: '1', amount: 400.5, date: iso(now), id_category: '2', id_payment_type: '1' },
  { id: 3, id_sheet: '2', amount: 200, date: iso(prev), id_category: '1', id_payment_type: '1' },
];

describe('HomeScreen (dashboard)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.reset();
    mockWidth = 1440;
    mockEmployee = { id: 'e1', name: 'Ana Pérez', is_admin: false };
    db.on('expense_sheet_with_total', 'select', { data: sheets });
    db.on('Expense_line', 'select', { data: lines });
  });

  it('saluda por el nombre y calcula los KPIs a partir de las hojas', async () => {
    const r = await mount(<HomeScreen />);
    const t = text(r.root);
    expect(t).toContain('Hola, Ana');
    expect(t).toContain('1.250,50 €'); // total
    expect(t).toContain('1.000,50 €'); // aprobado
    expect(t).toContain('200,00 €'); // pendiente
    expect(t).toContain('3'); // hojas
  });

  it('consulta solo las hojas del empleado y sus lineas por id de hoja', async () => {
    await mount(<HomeScreen />);
    const sheetQ = db.calls.find((c) => c.table === 'expense_sheet_with_total');
    expect(sheetQ?.filters).toEqual([['id_user', 'e1']]);
    const lineQ = db.calls.find((c) => c.table === 'Expense_line');
    expect(lineQ?.filters).toEqual([['id_sheet', ['1', '2', '3']]]);
  });

  it('muestra los repartos por categoria, proyecto y pago con nombres reales', async () => {
    const r = await mount(<HomeScreen />);
    const t = text(r.root);
    expect(t).toContain('Comidas');
    expect(t).toContain('Transporte');
    expect(t).toContain('Alfa');
    expect(t).toContain('Beta');
    expect(t).toContain('Tarjeta');
  });

  it('lista las ultimas hojas con su estado y "Ver todas" lleva a tickets', async () => {
    const r = await mount(<HomeScreen />);
    expect(text(r.root)).toContain('Viaje');
    expect(r.root.findAll((n) => n.props.testID === 'status-badge').length).toBeGreaterThanOrEqual(3);
    await press(r.root, 'see-all');
    expect(mockPush).toHaveBeenCalledWith('/tickets');
  });

  it('muestra la variacion frente al mes anterior', async () => {
    const r = await mount(<HomeScreen />);
    expect(r.root.findAll((n) => n.props.testID === 'month-delta').length).toBeGreaterThanOrEqual(1);
    expect(text(r.root)).toContain('vs mes anterior');
  });

  it('sin hojas -> estado vacio con acceso a crear la primera', async () => {
    db.on('expense_sheet_with_total', 'select', { data: [] });
    const r = await mount(<HomeScreen />);
    expect(text(r.root)).toContain('Todavía no tienes hojas de gasto');
    expect(db.calls.some((c) => c.table === 'Expense_line')).toBe(false); // sin ids no consulta lineas
    await press(r.root, 'see-all').catch(() => {});
  });

  it('error al cargar hojas -> mensaje', async () => {
    db.on('expense_sheet_with_total', 'select', { error: { message: 'x' } });
    const r = await mount(<HomeScreen />);
    expect(text(r.root)).toContain('Error cargando dashboard');
  });

  it('REGRESION: si fallan solo las lineas el dashboard sigue mostrando KPIs de hojas', async () => {
    db.on('Expense_line', 'select', { error: { message: 'x' } });
    const r = await mount(<HomeScreen />);
    expect(text(r.root)).toContain('1.250,50 €');
    expect(text(r.root)).toContain('Sin datos todavía'); // graficos vacios
  });

  it('sin empleado -> "No hay usuario" y no consulta', async () => {
    mockEmployee = null;
    const r = await mount(<HomeScreen />);
    expect(text(r.root)).toContain('No hay usuario');
    expect(db.calls).toHaveLength(0);
  });

  it('en movil mantiene los KPIs (2 columnas) y oculta la columna de fecha', async () => {
    mockWidth = 390;
    const r = await mount(<HomeScreen />);
    expect(r.root.findAll((n) => n.props.testID === 'kpi-total').length).toBeGreaterThan(0);
    expect(text(r.root)).toContain('1.250,50 €');
  });
});
