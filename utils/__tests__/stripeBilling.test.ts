import {
  BillingError, BillingRow, Deps, PRICE_PER_SEAT_CENTS, FREE_TICKET_LIMIT, billingAction, checkoutParams, formEncode, handleStripeEvent,
  isPaidStatus, monthlyCents, normalizeStatus, orgIdFromObject, portalParams, seatsToBill, shouldApplyEvent, signStripePayload,
  stripeClient, subscriptionToBilling, syncSeats, verifyStripeSignature,
} from '../../supabase/functions/_shared/stripe';

// jest-expo no siempre expone WebCrypto: se usa el de Node (las Edge Functions de Deno lo traen de serie)
beforeAll(() => {
  if (!(globalThis as any).crypto?.subtle) (globalThis as any).crypto = require('crypto').webcrypto;
});

const row = (over: Partial<BillingRow> = {}): BillingRow => ({
  id_organization: 7, tickets_created: 10, free_limit: 50, stripe_customer_id: null, stripe_subscription_id: null, status: 'none',
  seats: 0, current_period_end: null, cancel_at_period_end: false, last_event_at: null, ...over,
});

/** Dependencias falsas: base de datos en memoria y Stripe que registra las llamadas. */
function fakeDeps(initial: BillingRow | null, o: { seats?: number; stripe?: (m: string, p: string, params?: any) => any } = {}) {
  const rows = new Map<number, BillingRow>();
  if (initial) rows.set(initial.id_organization, initial);
  const calls: { method: string; path: string; params?: any }[] = [];
  const deps: Deps = {
    siteUrl: 'https://ticket.example.com/',
    stripe: { call: async (method, path, params) => { calls.push({ method, path, params }); return o.stripe ? o.stripe(method, path, params) : {}; } },
    db: {
      getBilling: async (id) => rows.get(id) ?? null,
      getBillingByCustomer: async (c) => [...rows.values()].find((r) => r.stripe_customer_id === c) ?? null,
      saveBilling: async (id, patch) => { rows.set(id, { ...(rows.get(id) ?? row({ id_organization: id })), ...patch } as BillingRow); },
      countSeats: async () => o.seats ?? 4,
    },
  };
  return { deps, rows, calls };
}

const sub = (over: any = {}) => ({
  id: 'sub_1', customer: 'cus_1', status: 'active', cancel_at_period_end: false, metadata: { org_id: '7' },
  items: { data: [{ id: 'si_1', quantity: 4, current_period_end: 1800000000 }] }, ...over,
});

describe('constantes de precio y limite', () => {
  it('2 EUR por trabajador y 50 tickets gratis', () => {
    expect(PRICE_PER_SEAT_CENTS).toBe(200);
    expect(FREE_TICKET_LIMIT).toBe(50);
  });
  it('plazas: una por empleado, minimo 1; cuota = plazas x 2 EUR', () => {
    expect(seatsToBill(6)).toBe(6);
    expect(seatsToBill(0)).toBe(1);
    expect(seatsToBill(-3)).toBe(1);
    expect(seatsToBill(NaN)).toBe(1);
    expect(seatsToBill(2.9)).toBe(2);
    expect(monthlyCents(6)).toBe(1200);
    expect(monthlyCents(0)).toBe(200);
  });
  it('active, trialing y past_due (gracia) son de pago; el resto no', () => {
    for (const s of ['active', 'trialing', 'past_due']) expect(isPaidStatus(s)).toBe(true);
    for (const s of ['none', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused', '', null, undefined]) expect(isPaidStatus(s as any)).toBe(false);
  });
  it('estados desconocidos de Stripe se normalizan a none', () => {
    expect(normalizeStatus('active')).toBe('active');
    expect(normalizeStatus('algo_nuevo')).toBe('none');
    expect(normalizeStatus(undefined)).toBe('none');
  });
});

describe('formEncode (cuerpo de la API de Stripe)', () => {
  it('anida objetos y arrays y omite null/undefined', () => {
    expect(decodeURIComponent(formEncode({ a: 1, b: { c: 'x', d: { e: true } }, f: [{ g: 1 }, { g: 2 }], h: null, i: undefined })))
      .toBe('a=1&b[c]=x&b[d][e]=true&f[0][g]=1&f[1][g]=2');
  });
  it('escapa caracteres especiales', () => {
    expect(formEncode({ email: 'a+b@x.com', q: 'a b&c' })).toBe('email=a%2Bb%40x.com&q=a%20b%26c');
  });
});

describe('checkoutParams / portalParams', () => {
  it('suscripcion mensual de 2 EUR con cantidad = trabajadores y la empresa en metadatos', () => {
    const p: any = checkoutParams({ orgId: 7, seats: 6, siteUrl: 'https://ticket.example.com/', email: 'admin@x.com' });
    expect(p.mode).toBe('subscription');
    expect(p.line_items[0].quantity).toBe(6);
    expect(p.line_items[0].price_data).toMatchObject({ currency: 'eur', unit_amount: 200, recurring: { interval: 'month' } });
    expect(p.client_reference_id).toBe('7');
    expect(p.metadata.org_id).toBe('7');
    expect(p.subscription_data.metadata.org_id).toBe('7');
    expect(p.customer_email).toBe('admin@x.com');
    expect(p.customer).toBeUndefined();
    expect(p.success_url).toBe('https://ticket.example.com/subscription?checkout=success&session_id={CHECKOUT_SESSION_ID}');
    expect(p.cancel_url).toBe('https://ticket.example.com/subscription?checkout=cancel');
    expect(p.tax_id_collection.enabled).toBe(true);
  });
  it('con cliente existente lo reutiliza (y no manda el correo); minimo 1 plaza', () => {
    const p: any = checkoutParams({ orgId: 7, seats: 0, siteUrl: 'https://x.test', customerId: 'cus_9', email: 'a@b.c' });
    expect(p.customer).toBe('cus_9');
    expect(p.customer_email).toBeUndefined();
    expect(p.customer_update).toEqual({ name: 'auto', address: 'auto' }); // requisito de Stripe para tax_id_collection con cliente existente
    expect(checkoutParams({ orgId: 7, seats: 1, siteUrl: 'https://x.test', email: 'a@b.c' }) as any).not.toHaveProperty('customer_update');
    expect(p.line_items[0].quantity).toBe(1);
  });
  it('el portal vuelve a la pestaña Suscripcion y admite configuracion propia', () => {
    expect(portalParams({ customerId: 'cus_1', siteUrl: 'https://x.test/' })).toEqual({ customer: 'cus_1', return_url: 'https://x.test/subscription' });
    expect(portalParams({ customerId: 'cus_1', siteUrl: 'https://x.test', configuration: 'bpc_1' }).configuration).toBe('bpc_1');
  });
});

describe('firma del webhook', () => {
  const secret = 'whsec_test';
  const body = JSON.stringify({ id: 'evt_1', type: 'x' });
  it('acepta una firma valida', async () => {
    expect(await verifyStripeSignature(body, await signStripePayload(body, secret), secret)).toBe(true);
  });
  it('rechaza cuerpo alterado, secreto distinto, cabecera ausente o mal formada', async () => {
    const header = await signStripePayload(body, secret);
    expect(await verifyStripeSignature(body + ' ', header, secret)).toBe(false);
    expect(await verifyStripeSignature(body, header, 'whsec_otro')).toBe(false);
    expect(await verifyStripeSignature(body, null, secret)).toBe(false);
    expect(await verifyStripeSignature(body, '', secret)).toBe(false);
    expect(await verifyStripeSignature(body, 'basura', secret)).toBe(false);
    expect(await verifyStripeSignature(body, 't=abc,v1=00', secret)).toBe(false);
    expect(await verifyStripeSignature(body, header, '')).toBe(false);
  });
  it('rechaza firmas fuera de la tolerancia de 5 minutos (repeticion)', async () => {
    const now = 1_800_000_000;
    const old = await signStripePayload(body, secret, now - 301);
    expect(await verifyStripeSignature(body, old, secret, now)).toBe(false);
    const ok = await signStripePayload(body, secret, now - 299);
    expect(await verifyStripeSignature(body, ok, secret, now)).toBe(true);
  });
  it('acepta varias firmas v1 si alguna coincide (rotacion de secretos)', async () => {
    const header = await signStripePayload(body, secret);
    expect(await verifyStripeSignature(body, header.replace('v1=', 'v1=deadbeef,v1='), secret)).toBe(true);
  });
});

describe('subscriptionToBilling / orgIdFromObject / shouldApplyEvent', () => {
  it('extrae estado, plazas y fin de periodo (API nueva: en el item)', () => {
    const b = subscriptionToBilling(sub({ cancel_at_period_end: true }));
    expect(b).toMatchObject({ stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1', status: 'active', seats: 4, cancel_at_period_end: true });
    expect(b.current_period_end).toBe(new Date(1800000000 * 1000).toISOString());
  });
  it('API antigua: current_period_end en la suscripcion; cliente expandido como objeto', () => {
    const b = subscriptionToBilling(sub({ current_period_end: 1700000000, customer: { id: 'cus_2' }, items: { data: [{ id: 'si', quantity: 2 }] } }));
    expect(b.current_period_end).toBe(new Date(1700000000 * 1000).toISOString());
    expect(b.stripe_customer_id).toBe('cus_2');
  });
  it('datos incompletos no rompen', () => {
    expect(subscriptionToBilling({})).toMatchObject({ status: 'none', seats: 0, current_period_end: null, cancel_at_period_end: false });
  });
  it('la empresa sale de metadata.org_id o de client_reference_id; valores raros -> null', () => {
    expect(orgIdFromObject({ metadata: { org_id: '12' } })).toBe(12);
    expect(orgIdFromObject({ client_reference_id: '5' })).toBe(5);
    for (const bad of [{}, { metadata: { org_id: 'abc' } }, { metadata: { org_id: '0' } }, { metadata: { org_id: '-3' } }, { metadata: { org_id: '1.5' } }, null]) {
      expect(orgIdFromObject(bad)).toBeNull();
    }
  });
  it('un evento anterior al ultimo aplicado se descarta', () => {
    expect(shouldApplyEvent(100, null)).toBe(true);
    expect(shouldApplyEvent(100, new Date(99_000).toISOString())).toBe(true);
    expect(shouldApplyEvent(100, new Date(100_000).toISOString())).toBe(true);
    expect(shouldApplyEvent(100, new Date(101_000).toISOString())).toBe(false);
  });
});

describe('billingAction', () => {
  const admin = { orgId: 7, isAdmin: true, email: 'admin@x.com' };

  it('SOLO la administracion: un empleado no puede contratar, abrir el portal ni sincronizar', async () => {
    const { deps, calls } = fakeDeps(row());
    for (const a of ['checkout', 'portal', 'sync', 'confirm']) {
      await expect(billingAction(a, { orgId: 7, isAdmin: false }, deps)).rejects.toMatchObject({ code: 'forbidden', http: 403 });
    }
    expect(calls).toHaveLength(0);
  });
  it('sin empresa no se puede nada', async () => {
    const { deps } = fakeDeps(null);
    await expect(billingAction('checkout', { orgId: null, isAdmin: true }, deps)).rejects.toMatchObject({ code: 'no_organization' });
  });
  it('accion desconocida', async () => {
    const { deps } = fakeDeps(row());
    await expect(billingAction('regalar', admin, deps)).rejects.toMatchObject({ code: 'bad_action' });
  });

  it('checkout: crea la sesion con tantas plazas como empleados y devuelve su URL', async () => {
    const { deps, calls } = fakeDeps(row(), { seats: 6, stripe: () => ({ url: 'https://checkout.stripe.test/c/1' }) });
    expect(await billingAction('checkout', admin, deps)).toEqual({ url: 'https://checkout.stripe.test/c/1' });
    expect(calls[0].path).toBe('/checkout/sessions');
    expect(calls[0].params.line_items[0].quantity).toBe(6);
    expect(calls[0].params.client_reference_id).toBe('7');
    expect(calls[0].params.customer_email).toBe('admin@x.com');
  });
  it('checkout: si ya hay cliente de Stripe lo reutiliza', async () => {
    const { deps, calls } = fakeDeps(row({ stripe_customer_id: 'cus_1', status: 'canceled' }), { stripe: () => ({ url: 'u' }) });
    await billingAction('checkout', admin, deps);
    expect(calls[0].params.customer).toBe('cus_1');
  });
  it('checkout: con suscripcion activa NO crea otra (evita cobrar dos veces)', async () => {
    const { deps, calls } = fakeDeps(row({ status: 'active', stripe_subscription_id: 'sub_1' }));
    await expect(billingAction('checkout', admin, deps)).rejects.toMatchObject({ code: 'already_subscribed', http: 409 });
    expect(calls).toHaveLength(0);
  });
  it('checkout: Stripe sin URL -> error 502', async () => {
    const { deps } = fakeDeps(row(), { stripe: () => ({}) });
    await expect(billingAction('checkout', admin, deps)).rejects.toMatchObject({ code: 'stripe_no_url', http: 502 });
  });

  it('portal: sin datos de pago pide contratar antes; con cliente abre el portal', async () => {
    const a = fakeDeps(row());
    await expect(billingAction('portal', admin, a.deps)).rejects.toMatchObject({ code: 'no_customer' });
    const b = fakeDeps(row({ stripe_customer_id: 'cus_1' }), { stripe: () => ({ url: 'https://portal.test/p' }) });
    b.deps.portalConfiguration = 'bpc_1';
    expect(await billingAction('portal', admin, b.deps)).toEqual({ url: 'https://portal.test/p' });
    expect(b.calls[0]).toMatchObject({ path: '/billing_portal/sessions', params: { customer: 'cus_1', configuration: 'bpc_1' } });
  });

  it('confirm: tras volver de Checkout guarda la suscripcion sin esperar al webhook', async () => {
    const { deps, rows } = fakeDeps(row(), {
      stripe: (_m, path) => (path.startsWith('/checkout/sessions/') ? { client_reference_id: '7', subscription: 'sub_1' } : sub()),
    });
    expect(await billingAction('confirm', admin, deps, { sessionId: 'cs_test_abc' })).toEqual({ confirmed: true, status: 'active' });
    expect(rows.get(7)).toMatchObject({ status: 'active', seats: 4, stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1' });
  });
  it('confirm: la sesion de OTRA empresa se rechaza (no se puede activar un plan ajeno)', async () => {
    const { deps, rows } = fakeDeps(row(), { stripe: () => ({ client_reference_id: '99', subscription: 'sub_x' }) });
    await expect(billingAction('confirm', admin, deps, { sessionId: 'cs_test_abc' })).rejects.toMatchObject({ code: 'forbidden' });
    expect(rows.get(7)?.status).toBe('none');
  });
  it('confirm: identificadores de sesion raros se rechazan antes de llamar a Stripe', async () => {
    const { deps, calls } = fakeDeps(row());
    for (const id of [undefined, '', 'sub_1', 'cs_x/../../customers', 'cs_ x']) {
      await expect(billingAction('confirm', admin, deps, { sessionId: id as any })).rejects.toMatchObject({ code: 'bad_session' });
    }
    expect(calls).toHaveLength(0);
  });
  it('confirm: sesion sin suscripcion todavia -> confirmed false', async () => {
    const { deps } = fakeDeps(row(), { stripe: () => ({ client_reference_id: '7', subscription: null }) });
    expect(await billingAction('confirm', admin, deps, { sessionId: 'cs_test_abc' })).toEqual({ confirmed: false });
  });
});

describe('syncSeats (plantilla -> cantidad de la suscripcion)', () => {
  const paid = () => row({ status: 'active', stripe_subscription_id: 'sub_1', seats: 4 });
  it('si cambia el numero de empleados actualiza la cantidad en Stripe con prorrateo', async () => {
    const { deps, calls, rows } = fakeDeps(paid(), { seats: 7, stripe: () => sub() });
    expect(await syncSeats(7, deps)).toEqual({ synced: true, seats: 7 });
    expect(calls[1]).toMatchObject({ method: 'POST', path: '/subscription_items/si_1', params: { quantity: 7, proration_behavior: 'create_prorations' } });
    expect(rows.get(7)?.seats).toBe(7);
  });
  it('si ya coincide no llama a Stripe para cambiar nada', async () => {
    const { deps, calls } = fakeDeps(paid(), { seats: 4, stripe: () => sub() });
    await syncSeats(7, deps);
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0);
  });
  it('en la renovacion (invoice.upcoming) no prorratea', async () => {
    const { deps, calls } = fakeDeps(paid(), { seats: 9, stripe: () => sub() });
    await syncSeats(7, deps, 'none');
    expect(calls[1].params.proration_behavior).toBe('none');
  });
  it('sin suscripcion de pago no hace nada', async () => {
    for (const r of [row(), row({ status: 'canceled', stripe_subscription_id: 'sub_1' }), null]) {
      const { deps, calls } = fakeDeps(r);
      expect((await syncSeats(7, deps)).synced).toBe(false);
      expect(calls).toHaveLength(0);
    }
  });
  it('la cuota nunca baja de 1 plaza', async () => {
    const { deps, calls } = fakeDeps(paid(), { seats: 0, stripe: () => sub({ items: { data: [{ id: 'si_1', quantity: 3 }] } }) });
    await syncSeats(7, deps);
    expect(calls[1].params.quantity).toBe(1);
  });
});

describe('handleStripeEvent (webhook)', () => {
  const ev = (type: string, object: any, created = 1_800_000_000) => ({ id: 'evt_' + type, type, created, data: { object } });

  it('checkout.session.completed activa la suscripcion de la empresa indicada', async () => {
    const { deps, rows } = fakeDeps(row(), { stripe: () => sub() });
    const r = await handleStripeEvent(ev('checkout.session.completed', { mode: 'subscription', client_reference_id: '7', customer: 'cus_1', subscription: 'sub_1' }), deps);
    expect(r.handled).toBe(true);
    expect(rows.get(7)).toMatchObject({ status: 'active', seats: 4, stripe_customer_id: 'cus_1' });
  });
  it('checkout de pago unico o sin empresa se ignora', async () => {
    const { deps, rows } = fakeDeps(row());
    expect((await handleStripeEvent(ev('checkout.session.completed', { mode: 'payment', client_reference_id: '7' }), deps)).handled).toBe(false);
    expect((await handleStripeEvent(ev('checkout.session.completed', { mode: 'subscription', subscription: 's' }), deps)).handled).toBe(false);
    expect(rows.get(7)?.status).toBe('none');
  });
  it('subscription.updated cambia estado, plazas y cancelacion programada', async () => {
    const { deps, rows } = fakeDeps(row({ status: 'active', stripe_customer_id: 'cus_1' }));
    await handleStripeEvent(ev('customer.subscription.updated', sub({ status: 'past_due', cancel_at_period_end: true })), deps);
    expect(rows.get(7)).toMatchObject({ status: 'past_due', cancel_at_period_end: true });
  });
  it('subscription.deleted deja la empresa en canceled (vuelve al limite gratuito)', async () => {
    const { deps, rows } = fakeDeps(row({ status: 'active' }));
    await handleStripeEvent(ev('customer.subscription.deleted', sub({ status: 'canceled' })), deps);
    expect(rows.get(7)?.status).toBe('canceled');
    expect(isPaidStatus(rows.get(7)?.status)).toBe(false);
  });
  it('localiza la empresa por el cliente si la suscripcion no lleva metadatos', async () => {
    const { deps, rows } = fakeDeps(row({ stripe_customer_id: 'cus_1' }));
    await handleStripeEvent(ev('customer.subscription.updated', sub({ metadata: {}, status: 'active' })), deps);
    expect(rows.get(7)?.status).toBe('active');
  });
  it('suscripcion de una empresa desconocida se ignora', async () => {
    const { deps, rows } = fakeDeps(row());
    const r = await handleStripeEvent(ev('customer.subscription.updated', sub({ metadata: {}, customer: 'cus_desconocido' })), deps);
    expect(r.handled).toBe(false);
    expect(rows.get(7)?.status).toBe('none');
  });
  it('REGRESION: un evento antiguo llegado tarde no pisa uno mas reciente', async () => {
    const { deps, rows } = fakeDeps(row({ stripe_customer_id: 'cus_1' }));
    await handleStripeEvent(ev('customer.subscription.updated', sub({ status: 'canceled' }), 2000), deps);
    expect(rows.get(7)?.status).toBe('canceled');
    const late = await handleStripeEvent(ev('customer.subscription.updated', sub({ status: 'active' }), 1000), deps);
    expect(late.handled).toBe(false);
    expect(rows.get(7)?.status).toBe('canceled');
  });
  it('es idempotente: procesar dos veces el mismo evento deja el mismo estado', async () => {
    const { deps, rows } = fakeDeps(row());
    const e = ev('customer.subscription.created', sub());
    await handleStripeEvent(e, deps);
    const first = { ...rows.get(7) };
    await handleStripeEvent(e, deps);
    expect(rows.get(7)).toEqual(first);
  });
  it('invoice.upcoming ajusta las plazas sin prorrateo', async () => {
    const { deps, calls } = fakeDeps(row({ status: 'active', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1', seats: 4 }), { seats: 8, stripe: () => sub() });
    const r = await handleStripeEvent(ev('invoice.upcoming', { customer: 'cus_1' }), deps);
    expect(r.handled).toBe(true);
    expect(calls.find((c) => c.method === 'POST')?.params).toMatchObject({ quantity: 8, proration_behavior: 'none' });
  });
  it('eventos que no interesan (o basura) no hacen nada y no fallan', async () => {
    const { deps, calls } = fakeDeps(row());
    for (const e of [ev('charge.succeeded', {}), {}, null, { type: 123 }]) expect((await handleStripeEvent(e, deps)).handled).toBe(false);
    expect(calls).toHaveLength(0);
  });
});

describe('stripeClient', () => {
  it('POST con cuerpo form-urlencoded y clave en Authorization; GET con parametros en la URL', async () => {
    const fetchMock = jest.fn(async (_u: any, _o: any) => ({ ok: true, status: 200, json: async () => ({ id: 'x' }) })) as any;
    const c = stripeClient('sk_test_123', fetchMock);
    await c.call('POST', '/checkout/sessions', { mode: 'subscription', line_items: [{ quantity: 2 }] });
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.stripe.com/v1/checkout/sessions');
    expect(opts.headers.Authorization).toBe('Bearer sk_test_123');
    expect(opts.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(decodeURIComponent(opts.body)).toBe('mode=subscription&line_items[0][quantity]=2');
    await c.call('GET', '/subscriptions/sub_1');
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.stripe.com/v1/subscriptions/sub_1');
    expect(fetchMock.mock.calls[1][1].body).toBeUndefined();
  });
  it('un error de Stripe se convierte en BillingError 502 con su mensaje y SIN filtrar la clave', async () => {
    const fetchMock = jest.fn(async () => ({ ok: false, status: 400, json: async () => ({ error: { message: 'No such price' } }) })) as any;
    const err: any = await stripeClient('sk_test_secret', fetchMock).call('POST', '/x', {}).catch((e) => e);
    expect(err).toBeInstanceOf(BillingError);
    expect(err.http).toBe(502);
    expect(err.message).toBe('No such price');
    expect(JSON.stringify(err)).not.toContain('sk_test_secret');
  });
});
