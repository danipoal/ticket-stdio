import * as React from 'react';
import { Linking } from 'react-native';
import { act } from 'react-test-renderer';
import { flush, mount, press, text } from '../test-utils/render';
import { db } from '../test-utils/supabaseMock';

jest.mock('@/utils/supabase', () => ({ supabase: require('../test-utils/supabaseMock').db.client }));
let mockEmployee: any = { id: 'admin1', is_admin: true };
jest.mock('@/context/useAuth', () => () => ({ employee: mockEmployee, loading: false }));
let mockWidth = 1440;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 900, scale: 1, fontScale: 1 }),
}));
let mockParams: any = {};
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
}));

import SubscriptionScreen from '@/app/(tabs)/subscription';

const status = (over: any = {}) => ({
  organization_id: 1, is_admin: true, used: 12, free_limit: 50, remaining: 38, paid: false, status: 'none', can_create: true,
  seats: 6, billed_seats: 0, price_per_seat_cents: 200, monthly_cents: 1200, current_period_end: null, cancel_at_period_end: false, ...over,
});
const fnCalls = () => db.calls.filter((c) => c.table === 'fn:billing');
const has = (r: any, id: string) => r.root.findAll((n: any) => n.props.testID === id).length > 0;

describe('SubscriptionScreen', () => {
  let openURL: jest.SpyInstance;
  beforeEach(() => {
    db.reset();
    mockWidth = 1440;
    mockParams = {};
    mockReplace.mockClear();
    mockEmployee = { id: 'admin1', is_admin: true };
    openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as any);
  });
  afterEach(() => openURL.mockRestore());

  it('un empleado (no admin) ve el area restringida y no consulta ni llama a nada', async () => {
    mockEmployee = { id: 'e1', is_admin: false };
    const r = await mount(<SubscriptionScreen />);
    expect(text(r.root)).toContain('Área restringida');
    expect(text(r.root)).toContain('administración');
    expect(fnCalls()).toHaveLength(0); // nada de Stripe ni de tablas: solo la RPC de estado, que es inocua
    expect(db.calls.filter((c) => c.op !== 'rpc')).toHaveLength(0);
  });

  it('plan gratuito: uso X de 50, cuota por trabajador y boton Activar suscripcion', async () => {
    db.onRpc('billing_status', { data: status() });
    const r = await mount(<SubscriptionScreen />);
    const t = text(r.root);
    expect(t).toContain('Plan gratuito');
    expect(t).toContain('12');
    expect(t).toMatch(/de\s+50\s+gratuitos/);
    expect(t).toContain('Los tickets borrados también cuentan');
    expect(t).toContain('12,00 €');
    expect(t).toContain('6 trabajadores × 2,00 € = 12,00 € al mes');
    expect(has(r, 'sub-checkout')).toBe(true);
    expect(has(r, 'sub-portal')).toBe(false);
    expect(has(r, 'billing-blocked')).toBe(false);
  });

  it('la barra de uso refleja el porcentaje', async () => {
    db.onRpc('billing_status', { data: status({ used: 25, remaining: 25 }) });
    const r = await mount(<SubscriptionScreen />);
    const bar = r.root.findAll((n) => n.props.testID === 'usage-bar')[0];
    expect(JSON.stringify(bar.props.style)).toContain('50%');
  });

  it('Activar suscripcion llama a la funcion y abre la pagina de pago de Stripe', async () => {
    db.onRpc('billing_status', { data: status() });
    db.onFunction('billing', { data: { url: 'https://checkout.stripe.test/c/1' } });
    const r = await mount(<SubscriptionScreen />);
    await press(r.root, 'sub-checkout');
    expect(fnCalls()[0].payload).toEqual({ action: 'checkout' });
    expect(openURL).toHaveBeenCalledWith('https://checkout.stripe.test/c/1');
  });

  it('pasarela sin configurar: aviso claro y la empresa sigue con su cupo gratuito', async () => {
    db.onRpc('billing_status', { data: status() });
    db.onFunction('billing', { data: { error: 'not_configured', message: 'x' } });
    const r = await mount(<SubscriptionScreen />);
    await press(r.root, 'sub-checkout');
    expect(has(r, 'billing-not-configured')).toBe(true);
    expect(text(r.root)).toContain('todavía no está activada');
    expect(openURL).not.toHaveBeenCalled();
  });

  it('error de la funcion: se muestra su mensaje', async () => {
    db.onRpc('billing_status', { data: status() });
    db.onFunction('billing', { error: { message: 'x', context: { json: async () => ({ error: 'stripe_error', message: 'Stripe está caído' }) } } });
    const r = await mount(<SubscriptionScreen />);
    await press(r.root, 'sub-checkout');
    expect(text(r.root)).toContain('Stripe está caído');
  });

  it('cupo agotado: aviso rojo y barra al 100 %', async () => {
    db.onRpc('billing_status', { data: status({ used: 50, remaining: 0, can_create: false }) });
    const r = await mount(<SubscriptionScreen />);
    expect(has(r, 'billing-blocked')).toBe(true);
    expect(text(r.root)).toContain('Plan gratuito agotado');
    expect(text(r.root)).toContain('Sin cupo');
  });

  it('suscripcion activa: sin limite, boton de gestionar pago/facturas y nada de Activar', async () => {
    db.onRpc('billing_status', { data: status({ paid: true, status: 'active', billed_seats: 6, used: 300, current_period_end: '2027-01-15T00:00:00Z' }) });
    db.onFunction('billing', { data: { url: 'https://billing.stripe.test/p/1' } });
    const r = await mount(<SubscriptionScreen />);
    const t = text(r.root);
    expect(t).toContain('Suscripción activa');
    expect(t).toContain('Próxima renovación: 15/1/2027');
    expect(t).toContain('sin límite');
    expect(has(r, 'sub-checkout')).toBe(false);
    await press(r.root, 'sub-portal');
    expect(fnCalls()[0].payload).toEqual({ action: 'portal' });
    expect(openURL).toHaveBeenCalledWith('https://billing.stripe.test/p/1');
    expect(fnCalls().some((c) => c.payload.action === 'sync')).toBe(false); // plazas ya coinciden
  });

  it('plazas cobradas distintas de los trabajadores: se sincronizan solas al abrir la pestaña', async () => {
    let calls = 0;
    db.onRpc('billing_status', () => ({ data: status({ paid: true, status: 'active', seats: 8, monthly_cents: 1600, billed_seats: calls++ === 0 ? 6 : 8 }) }));
    db.onFunction('billing', { data: { synced: true, seats: 8 } });
    const r = await mount(<SubscriptionScreen />);
    await flush();
    expect(fnCalls().filter((c) => c.payload.action === 'sync')).toHaveLength(1);
    expect(text(r.root)).toContain('8 trabajadores × 2,00 € = 16,00 € al mes');
  });

  it('pago pendiente (gracia): avisa pero mantiene el acceso', async () => {
    db.onRpc('billing_status', { data: status({ paid: true, status: 'past_due', billed_seats: 6 }) });
    const r = await mount(<SubscriptionScreen />);
    expect(text(r.root)).toContain('Pago pendiente');
    expect(has(r, 'billing-blocked')).toBe(false);
  });

  it('cancelacion programada: indica hasta cuando sigue activa', async () => {
    db.onRpc('billing_status', { data: status({ paid: true, status: 'active', billed_seats: 6, cancel_at_period_end: true, current_period_end: '2027-02-01T00:00:00Z' }) });
    const r = await mount(<SubscriptionScreen />);
    expect(text(r.root)).toContain('Se cancela al final del periodo');
    expect(text(r.root)).toContain('1/2/2027');
  });

  it('suscripcion cancelada: ofrece volver a suscribirse y abrir facturas', async () => {
    db.onRpc('billing_status', { data: status({ status: 'canceled', used: 80, remaining: 0, can_create: false }) });
    const r = await mount(<SubscriptionScreen />);
    expect(text(r.root)).toContain('Volver a suscribirse');
    expect(has(r, 'sub-portal-secondary')).toBe(true);
  });

  it('vuelta de Stripe con pago correcto: confirma la sesion, avisa y limpia la URL', async () => {
    mockParams = { checkout: 'success', session_id: 'cs_test_1' };
    let confirmed = false;
    db.onRpc('billing_status', () => ({ data: confirmed ? status({ paid: true, status: 'active', billed_seats: 6 }) : status() }));
    db.onFunction('billing', () => { confirmed = true; return { data: { confirmed: true, status: 'active' } }; });
    const r = await mount(<SubscriptionScreen />);
    expect(fnCalls()[0].payload).toEqual({ action: 'confirm', sessionId: 'cs_test_1' });
    expect(text(r.root)).toContain('Suscripción activada');
    expect(text(r.root)).toContain('Suscripción activa');
    expect(mockReplace).toHaveBeenCalledWith('/subscription');
  });

  it('vuelta de Stripe con pago aun sin confirmar: pide esperar unos segundos', async () => {
    mockParams = { checkout: 'success', session_id: 'cs_test_1' };
    db.onRpc('billing_status', { data: status() });
    db.onFunction('billing', { data: { confirmed: false } });
    const r = await mount(<SubscriptionScreen />);
    expect(text(r.root)).toContain('unos segundos');
  });

  it('vuelta de Stripe cancelando: no se cobra nada y no se llama a la funcion', async () => {
    mockParams = { checkout: 'cancel' };
    db.onRpc('billing_status', { data: status() });
    const r = await mount(<SubscriptionScreen />);
    expect(text(r.root)).toContain('No se ha cobrado nada');
    expect(fnCalls()).toHaveLength(0);
    expect(mockReplace).toHaveBeenCalledWith('/subscription');
  });

  it('un empleado con ?checkout=success en la URL no dispara ninguna llamada', async () => {
    mockEmployee = { id: 'e1', is_admin: false };
    mockParams = { checkout: 'success', session_id: 'cs_test_1' };
    await mount(<SubscriptionScreen />);
    expect(fnCalls()).toHaveLength(0);
  });

  it('sin estado (RPC no disponible) muestra un aviso en vez de romperse', async () => {
    db.onRpc('billing_status', { error: { message: 'function not found' } });
    const r = await mount(<SubscriptionScreen />);
    expect(has(r, 'billing-unavailable')).toBe(true);
  });

  it('REGRESION: dos clics seguidos sobre Activar abren UN solo pago (guarda con referencia, no con estado)', async () => {
    db.onRpc('billing_status', { data: status() });
    db.onFunction('billing', { data: { url: 'https://checkout.stripe.test/c/1' } });
    const r = await mount(<SubscriptionScreen />);
    const btn = r.root.findAll((n) => n.props.testID === 'sub-checkout' && typeof n.props.onPress === 'function')[0];
    await act(async () => { btn.props.onPress(); btn.props.onPress(); }); // mismo fotograma: el estado aun no se ha actualizado
    await flush();
    expect(fnCalls().filter((c) => c.payload.action === 'checkout')).toHaveLength(1);
    expect(openURL).toHaveBeenCalledTimes(1);
  });
});
