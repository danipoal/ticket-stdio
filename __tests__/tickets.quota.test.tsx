import * as React from 'react';
import { mount, press, text, type } from '../test-utils/render';
import { db } from '../test-utils/supabaseMock';

jest.mock('@/utils/supabase', () => ({ supabase: require('../test-utils/supabaseMock').db.client }));
let mockEmployee: any = { id: 'e1', is_admin: false };
jest.mock('@/context/useAuth', () => () => ({ employee: mockEmployee }));
jest.mock('@/context/useAux', () => () => ({ paymentTypes: [], categories: [], sheetStatuses: [] }));
jest.mock('@/utils/confirm', () => ({ confirmAction: jest.fn() }));
jest.mock('expo-file-system', () => ({}));
jest.mock('expo-sharing', () => ({}));
jest.mock('expo-image-picker', () => ({ MediaTypeOptions: { Images: 'Images' } }));
jest.mock('expo-web-browser', () => ({}));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn() }) }));
let mockWidth = 390;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 900, scale: 1, fontScale: 1 }),
}));

import TicketsScreen from '@/app/(tabs)/tickets';

const status = (over: any = {}) => ({
  organization_id: 1, is_admin: false, used: 10, free_limit: 50, remaining: 40, paid: false, status: 'none', can_create: true,
  seats: 6, billed_seats: 0, price_per_seat_cents: 200, monthly_cents: 1200, current_period_end: null, cancel_at_period_end: false, ...over,
});
const blocked = () => status({ used: 50, remaining: 0, can_create: false });
const addButton = (r: any) => r.root.findAll((n: any) => n.props.testID === 'add-button' && 'disabled' in n.props)[0] ?? r.root.findAll((n: any) => n.props.testID === 'add-button')[0];
const has = (r: any, id: string) => r.root.findAll((n: any) => n.props.testID === id).length > 0;

describe.each([['movil', 390], ['escritorio', 1440]])('TicketsScreen · cupo de tickets (%s)', (_name, width) => {
  beforeEach(() => {
    db.reset();
    mockPush.mockClear();
    mockWidth = width as number;
    mockEmployee = { id: 'e1', is_admin: false };
    db.on('expense_sheet_with_total', 'select', { data: [] });
  });

  it('sin estado de facturacion (migracion sin aplicar) todo funciona como antes: sin avisos y con boton activo', async () => {
    const r = await mount(<TicketsScreen />);
    expect(has(r, 'quota-blocked')).toBe(false);
    expect(has(r, 'quota-low')).toBe(false);
    expect(addButton(r).props.disabled).toBeFalsy();
  });

  it('con cupo de sobra no hay aviso', async () => {
    db.onRpc('billing_status', { data: status() });
    const r = await mount(<TicketsScreen />);
    expect(has(r, 'quota-blocked')).toBe(false);
    expect(has(r, 'quota-low')).toBe(false);
  });

  it('quedan pocos: aviso amarillo para todos, sin bloquear el boton', async () => {
    db.onRpc('billing_status', { data: status({ used: 47, remaining: 3 }) });
    const r = await mount(<TicketsScreen />);
    expect(has(r, 'quota-low')).toBe(true);
    expect(text(r.root)).toContain('Quedan 3 tickets gratuitos de 50');
    expect(addButton(r).props.disabled).toBeFalsy();
  });

  it('EMPLEADO con cupo agotado: aviso rojo que le dice que avise a la administracion, boton desactivado y sin enlace a Suscripcion', async () => {
    db.onRpc('billing_status', { data: blocked() });
    const r = await mount(<TicketsScreen />);
    expect(has(r, 'quota-blocked')).toBe(true);
    expect(text(r.root)).toContain('no se pueden crear más');
    expect(text(r.root)).toContain('Avisa a la administración');
    expect(addButton(r).props.disabled).toBe(true);
    expect(has(r, 'quota-manage')).toBe(false);
  });

  it('ADMINISTRACION con cupo agotado: aviso con enlace directo a la pestaña Suscripcion', async () => {
    mockEmployee = { id: 'a1', is_admin: true };
    db.onRpc('billing_status', { data: { ...blocked(), is_admin: true } });
    const r = await mount(<TicketsScreen />);
    expect(text(r.root)).toContain('Activa la suscripción');
    await press(r.root, 'quota-manage');
    expect(mockPush).toHaveBeenCalledWith('/subscription');
  });

  it('con suscripcion de pago no hay limite aunque el contador sea enorme', async () => {
    db.onRpc('billing_status', { data: status({ paid: true, status: 'active', used: 900, remaining: 0, can_create: true }) });
    const r = await mount(<TicketsScreen />);
    expect(has(r, 'quota-blocked')).toBe(false);
    expect(addButton(r).props.disabled).toBeFalsy();
  });

  it('REGRESION: otro compañero gasta el ultimo cupo mientras se rellena el formulario -> mensaje claro y bloqueo, sin "inténtalo de nuevo"', async () => {
    let first = true;
    db.onRpc('billing_status', () => ({ data: first ? status({ used: 49, remaining: 1 }) : blocked() }));
    db.on('Expense_sheet', 'insert', () => { first = false; return { error: { code: 'PT402', message: 'ticket_limit_reached' } as any }; });
    const r = await mount(<TicketsScreen />);
    await press(r.root, 'add-button');
    await type(r.root, 'sheet-title', 'Viaje');
    await type(r.root, 'sheet-project', 'Alfa');
    await press(r.root, 'sheet-create');
    expect(text(r.root)).toContain('no se pueden crear más');
    expect(text(r.root)).not.toContain('Inténtalo de nuevo');
  });

  it('crear una hoja con exito vuelve a consultar el cupo (el contador sube)', async () => {
    db.onRpc('billing_status', { data: status({ used: 10, remaining: 40 }) });
    db.on('Expense_sheet', 'insert', { data: { id: 99 } });
    const r = await mount(<TicketsScreen />);
    const before = db.calls.filter((c) => c.table === 'rpc:billing_status').length;
    await press(r.root, 'add-button');
    await type(r.root, 'sheet-title', 'Viaje');
    await type(r.root, 'sheet-project', 'Alfa');
    await press(r.root, 'sheet-create');
    expect(db.calls.filter((c) => c.table === 'rpc:billing_status').length).toBeGreaterThan(before);
  });

  it('otros errores al crear siguen mostrando el mensaje generico', async () => {
    db.onRpc('billing_status', { data: status() });
    db.on('Expense_sheet', 'insert', { error: { code: '23505', message: 'duplicate' } as any });
    const r = await mount(<TicketsScreen />);
    await press(r.root, 'add-button');
    await type(r.root, 'sheet-title', 'Viaje');
    await type(r.root, 'sheet-project', 'Alfa');
    await press(r.root, 'sheet-create');
    expect(text(r.root)).toContain('No se pudo crear la hoja');
  });
});
