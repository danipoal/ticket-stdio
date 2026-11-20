import { db } from '../../test-utils/supabaseMock';

jest.mock('@/utils/supabase', () => ({ supabase: require('../../test-utils/supabaseMock').db.client }));

import { BillingStatus, eur, invokeBilling, isLimitError, limitLevel, limitMessage, planLabel, priceBreakdown, usagePercent } from '../billing';

const st = (over: Partial<BillingStatus> = {}): BillingStatus => ({
  organization_id: 1, is_admin: false, used: 10, free_limit: 50, remaining: 40, paid: false, status: 'none', can_create: true,
  seats: 6, billed_seats: 0, price_per_seat_cents: 200, monthly_cents: 1200, current_period_end: null, cancel_at_period_end: false, ...over,
});

describe('isLimitError (HTTP 402 de la base de datos)', () => {
  it('reconoce el codigo PT402, el estado 402 y el mensaje', () => {
    expect(isLimitError({ code: 'PT402', message: 'x' })).toBe(true);
    expect(isLimitError({ status: 402 })).toBe(true);
    expect(isLimitError({ message: 'ticket_limit_reached' })).toBe(true);
    expect(isLimitError({ message: 'TICKET_LIMIT_REACHED' })).toBe(true);
  });
  it('otros errores o ausencia de error no son de limite', () => {
    expect(isLimitError(null)).toBe(false);
    expect(isLimitError(undefined)).toBe(false);
    expect(isLimitError({ code: '23505', message: 'duplicate key' })).toBe(false);
    expect(isLimitError({ status: 500 })).toBe(false);
  });
});

describe('limitLevel', () => {
  it('con suscripcion de pago nunca hay aviso ni bloqueo', () => {
    expect(limitLevel(st({ paid: true, used: 500, remaining: 0, can_create: true }))).toBe('ok');
  });
  it('sin estado (migracion sin aplicar) no bloquea', () => {
    expect(limitLevel(null)).toBe('ok');
    expect(limitLevel(undefined)).toBe('ok');
  });
  it('avisa cuando quedan 5 o menos y bloquea al llegar a 0', () => {
    expect(limitLevel(st({ remaining: 6 }))).toBe('ok');
    expect(limitLevel(st({ remaining: 5 }))).toBe('low');
    expect(limitLevel(st({ remaining: 1 }))).toBe('low');
    expect(limitLevel(st({ remaining: 0, can_create: false, used: 50 }))).toBe('blocked');
  });
});

describe('limitMessage', () => {
  it('bloqueo: al empleado le dice que avise a la administracion; a la administracion que active la suscripcion', () => {
    const blocked = st({ used: 50, remaining: 0, can_create: false });
    expect(limitMessage(blocked, false)).toMatch(/no se pueden crear más/);
    expect(limitMessage(blocked, false)).toMatch(/administración/);
    expect(limitMessage(blocked, true)).toMatch(/Activa la suscripción/);
    expect(limitMessage(blocked, true)).toMatch(/borrados también cuentan/);
    expect(limitMessage(blocked, false)).toContain('50 tickets gratuitos');
  });
  it('aviso previo en singular y plural', () => {
    expect(limitMessage(st({ remaining: 1 }), false)).toContain('Quedan 1 ticket gratuito de 50');
    expect(limitMessage(st({ remaining: 4 }), true)).toContain('Quedan 4 tickets gratuitos de 50');
  });
});

describe('usagePercent / eur / priceBreakdown', () => {
  it('porcentaje acotado entre 0 y 100', () => {
    expect(usagePercent({ used: 25, free_limit: 50 })).toBe(50);
    expect(usagePercent({ used: 0, free_limit: 50 })).toBe(0);
    expect(usagePercent({ used: 80, free_limit: 50 })).toBe(100);
    expect(usagePercent({ used: 1, free_limit: 0 })).toBe(100);
  });
  it('importes en euros con coma', () => {
    expect(eur(200)).toBe('2,00 €');
    expect(eur(1200)).toBe('12,00 €');
    expect(eur(0)).toBe('0,00 €');
    expect(eur(null)).toBe('0,00 €');
  });
  it('desglose de la cuota: trabajadores x 2 euros', () => {
    expect(priceBreakdown({ seats: 6, price_per_seat_cents: 200, monthly_cents: 1200 })).toBe('6 trabajadores × 2,00 € = 12,00 € al mes');
    expect(priceBreakdown({ seats: 1, price_per_seat_cents: 200, monthly_cents: 200 })).toBe('1 trabajador × 2,00 € = 2,00 € al mes');
    expect(priceBreakdown({ seats: 0, price_per_seat_cents: 200, monthly_cents: 200 })).toBe('1 trabajador × 2,00 € = 2,00 € al mes');
  });
});

describe('planLabel', () => {
  it('gratuito, agotado, activo, pago pendiente, cancelacion programada y cancelado', () => {
    expect(planLabel(st())).toMatchObject({ label: 'Plan gratuito', tone: 'neutral' });
    expect(planLabel(st({ used: 50, remaining: 0, can_create: false }))).toMatchObject({ label: 'Plan gratuito agotado', tone: 'danger' });
    expect(planLabel(st({ paid: true, status: 'active' }))).toMatchObject({ label: 'Suscripción activa', tone: 'success' });
    expect(planLabel(st({ paid: true, status: 'past_due' }))).toMatchObject({ label: 'Pago pendiente', tone: 'warning' });
    expect(planLabel(st({ paid: true, status: 'active', cancel_at_period_end: true, current_period_end: '2027-01-15T12:00:00Z' })).detail).toContain('15/1/2027');
    expect(planLabel(st({ status: 'canceled' }))).toMatchObject({ label: 'Suscripción cancelada', tone: 'danger' });
  });
});

describe('invokeBilling', () => {
  beforeEach(() => db.reset());

  it('envia la accion y devuelve los datos', async () => {
    db.onFunction('billing', { data: { url: 'https://checkout.test/1' } });
    expect(await invokeBilling('checkout')).toEqual({ ok: true, data: { url: 'https://checkout.test/1' } });
    expect(db.calls[0]).toMatchObject({ table: 'fn:billing', payload: { action: 'checkout' } });
  });
  it('adjunta parametros extra (sessionId)', async () => {
    db.onFunction('billing', { data: { confirmed: true } });
    await invokeBilling('confirm', { sessionId: 'cs_1' });
    expect(db.calls[0].payload).toEqual({ action: 'confirm', sessionId: 'cs_1' });
  });
  it('pasarela sin configurar: la funcion responde 200 con {error}', async () => {
    db.onFunction('billing', { data: { error: 'not_configured', message: 'sin configurar' } });
    expect(await invokeBilling('checkout')).toEqual({ ok: false, code: 'not_configured', message: 'sin configurar' });
  });
  it('error HTTP de la funcion: lee {error, message} del cuerpo', async () => {
    db.onFunction('billing', { error: { message: 'Edge Function returned a non-2xx status code', context: { json: async () => ({ error: 'forbidden', message: 'Solo la administración' }) } } });
    expect(await invokeBilling('portal')).toEqual({ ok: false, code: 'forbidden', message: 'Solo la administración' });
  });
  it('error de red o cuerpo ilegible: mensaje generico', async () => {
    db.onFunction('billing', { error: { message: 'Failed to fetch' } });
    expect(await invokeBilling('portal')).toMatchObject({ ok: false, code: 'network' });
    db.onFunction('billing', { error: { message: 'x', context: { json: async () => { throw new Error('no json'); } } } });
    expect(await invokeBilling('portal')).toMatchObject({ ok: false, code: 'network' });
    db.onFunction('billing', () => { throw new Error('boom'); });
    expect(await invokeBilling('portal')).toMatchObject({ ok: false, code: 'network' });
  });
});
