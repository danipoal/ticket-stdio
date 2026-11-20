// Logica de facturacion con Stripe. SIN dependencias de Deno ni de Supabase: la usan las Edge Functions
// (`billing` y `stripe-webhook`) y los tests de Jest (`utils/__tests__/stripeBilling.test.ts`).
// Las funciones reciben sus dependencias (llamadas a Stripe y a la base de datos) por parametro.
//
// Modelo de cobro: suscripcion mensual de 2 EUR por trabajador (plaza) de la empresa. La cantidad de la suscripcion es el
// numero de empleados; la administracion la paga y la gestiona (Checkout para contratar, portal de cliente para tarjeta,
// facturas y baja). Sin suscripcion activa, cada empresa tiene 50 tickets gratis (el contador vive en la base de datos).

export const PRICE_PER_SEAT_CENTS = 200;
export const FREE_TICKET_LIMIT = 50;
export const CURRENCY = 'eur';
export const PRODUCT_NAME = 'Ticket Stdio · suscripción por trabajador';

export const STATUSES = ['none', 'incomplete', 'trialing', 'active', 'past_due', 'unpaid', 'canceled', 'incomplete_expired', 'paused'] as const;
export type SubStatus = (typeof STATUSES)[number];
/** Estados en los que la empresa puede crear tickets sin limite (past_due = gracia mientras Stripe reintenta el cobro). */
export const PAID_STATUSES: SubStatus[] = ['trialing', 'active', 'past_due'];
export const isPaidStatus = (s: string | null | undefined) => PAID_STATUSES.includes(s as SubStatus);
export const normalizeStatus = (s: unknown): SubStatus => ((STATUSES as readonly string[]).includes(String(s)) ? (String(s) as SubStatus) : 'none');

export class BillingError extends Error {
  constructor(public code: string, message: string, public http = 400) {
    super(message);
  }
}

// ------------------------------------------------------------------------------------------------ utilidades

/** Codifica parametros anidados como los espera la API de Stripe (`a[b][0][c]=1`). Omite null/undefined. */
export function formEncode(params: Record<string, unknown>): string {
  const pairs: string[] = [];
  const walk = (prefix: string, value: unknown) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) value.forEach((v, i) => walk(`${prefix}[${i}]`, v));
    else if (typeof value === 'object') for (const [k, v] of Object.entries(value as Record<string, unknown>)) walk(`${prefix}[${k}]`, v);
    else pairs.push(`${encodeURIComponent(prefix)}=${encodeURIComponent(String(value))}`);
  };
  for (const [k, v] of Object.entries(params)) walk(k, v);
  return pairs.join('&');
}

/** Plazas a cobrar: una por empleado, minimo 1. */
export const seatsToBill = (employeeCount: number) => Math.max(1, Math.floor(Number(employeeCount) || 0));
export const monthlyCents = (seats: number) => seatsToBill(seats) * PRICE_PER_SEAT_CENTS;

const trimSlash = (u: string) => u.replace(/\/+$/, '');

/** Parametros de la sesion de Checkout (modo suscripcion). El precio va en linea: no hace falta crear productos en Stripe. */
export function checkoutParams(o: { orgId: number; seats: number; siteUrl: string; customerId?: string | null; email?: string | null }) {
  const site = trimSlash(o.siteUrl);
  return {
    mode: 'subscription',
    line_items: [
      {
        quantity: seatsToBill(o.seats),
        price_data: { currency: CURRENCY, unit_amount: PRICE_PER_SEAT_CENTS, recurring: { interval: 'month' }, product_data: { name: PRODUCT_NAME } },
      },
    ],
    client_reference_id: String(o.orgId),
    metadata: { org_id: String(o.orgId) },
    subscription_data: { metadata: { org_id: String(o.orgId) } },
    // Con un cliente ya existente, Stripe exige customer_update para poder recoger NIF/CIF y direccion en el Checkout
    ...(o.customerId ? { customer: o.customerId, customer_update: { name: 'auto', address: 'auto' } } : o.email ? { customer_email: o.email } : {}),
    billing_address_collection: 'required',
    tax_id_collection: { enabled: true },
    allow_promotion_codes: true,
    locale: 'es',
    success_url: `${site}/subscription?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${site}/subscription?checkout=cancel`,
  };
}

export function portalParams(o: { customerId: string; siteUrl: string; configuration?: string | null }) {
  return { customer: o.customerId, return_url: `${trimSlash(o.siteUrl)}/subscription`, ...(o.configuration ? { configuration: o.configuration } : {}) };
}

// ------------------------------------------------------------------------------------------------ firma del webhook

const toHex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');

async function hmacHex(secret: string, message: string): Promise<string> {
  const subtle = (globalThis as any).crypto.subtle as SubtleCrypto;
  const key = await subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(await subtle.sign('HMAC', key, new TextEncoder().encode(message)));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Verifica la cabecera `Stripe-Signature` (`t=...,v1=...`) del cuerpo EXACTO recibido. Tolerancia de 5 minutos. */
export async function verifyStripeSignature(payload: string, header: string | null | undefined, secret: string, nowSec = Math.floor(Date.now() / 1000), toleranceSec = 300): Promise<boolean> {
  if (!header || !secret) return false;
  const parts = header.split(',').map((p) => p.trim().split('='));
  const t = parts.find(([k]) => k === 't')?.[1];
  const sigs = parts.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!t || sigs.length === 0 || !/^\d+$/.test(t)) return false;
  if (Math.abs(nowSec - Number(t)) > toleranceSec) return false;
  const expected = await hmacHex(secret, `${t}.${payload}`);
  return sigs.some((s) => safeEqual(s, expected));
}

/** Utilidad para tests y para el script de configuracion: firma un cuerpo como lo haria Stripe. */
export async function signStripePayload(payload: string, secret: string, t = Math.floor(Date.now() / 1000)): Promise<string> {
  return `t=${t},v1=${await hmacHex(secret, `${t}.${payload}`)}`;
}

// ------------------------------------------------------------------------------------------------ objetos de Stripe -> base de datos

export interface BillingRow {
  id_organization: number;
  tickets_created: number;
  free_limit: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: SubStatus;
  seats: number;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  last_event_at: string | null;
}

export function orgIdFromObject(obj: any): number | null {
  const raw = obj?.metadata?.org_id ?? obj?.client_reference_id;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Datos de la suscripcion que se guardan. Soporta la API antigua (`current_period_end` en la suscripcion) y la nueva (en cada item). */
export function subscriptionToBilling(sub: any): Partial<BillingRow> {
  const item = sub?.items?.data?.[0];
  const end = sub?.current_period_end ?? item?.current_period_end;
  return {
    stripe_customer_id: typeof sub?.customer === 'string' ? sub.customer : sub?.customer?.id ?? null,
    stripe_subscription_id: sub?.id ?? null,
    status: normalizeStatus(sub?.status),
    seats: Number.isFinite(Number(item?.quantity)) ? Number(item.quantity) : 0,
    current_period_end: end ? new Date(Number(end) * 1000).toISOString() : null,
    cancel_at_period_end: !!sub?.cancel_at_period_end,
  };
}

/** Un evento mas antiguo que el ultimo aplicado no debe pisar el estado (Stripe no garantiza el orden). */
export function shouldApplyEvent(eventCreatedSec: number, lastEventAtIso: string | null | undefined): boolean {
  if (!lastEventAtIso) return true;
  return eventCreatedSec * 1000 >= new Date(lastEventAtIso).getTime();
}

// ------------------------------------------------------------------------------------------------ dependencias y casos de uso

export interface Deps {
  stripe: { call(method: 'GET' | 'POST', path: string, params?: Record<string, unknown>): Promise<any> };
  db: {
    getBilling(orgId: number): Promise<BillingRow | null>;
    getBillingByCustomer(customerId: string): Promise<BillingRow | null>;
    saveBilling(orgId: number, patch: Partial<BillingRow>): Promise<void>;
    countSeats(orgId: number): Promise<number>;
  };
  siteUrl: string;
  portalConfiguration?: string | null;
}

export interface Caller {
  orgId: number | null;
  isAdmin: boolean;
  email?: string | null;
}

function requireAdmin(caller: Caller): number {
  if (!caller.orgId) throw new BillingError('no_organization', 'Tu usuario no pertenece a ninguna empresa', 403);
  if (!caller.isAdmin) throw new BillingError('forbidden', 'Solo la administración de la empresa puede gestionar la suscripción', 403);
  return caller.orgId;
}

/** Ajusta la cantidad de la suscripcion al numero de empleados. `proration`: 'create_prorations' (ahora) o 'none' (en la renovacion). */
export async function syncSeats(orgId: number, deps: Deps, proration: 'create_prorations' | 'none' = 'create_prorations') {
  const row = await deps.db.getBilling(orgId);
  if (!row?.stripe_subscription_id || !isPaidStatus(row.status)) return { synced: false, seats: row?.seats ?? 0 };
  const seats = seatsToBill(await deps.db.countSeats(orgId));
  const sub = await deps.stripe.call('GET', `/subscriptions/${row.stripe_subscription_id}`);
  const item = sub?.items?.data?.[0];
  if (!item) throw new BillingError('no_subscription_item', 'La suscripción no tiene líneas', 502);
  if (Number(item.quantity) !== seats) {
    await deps.stripe.call('POST', `/subscription_items/${item.id}`, { quantity: seats, proration_behavior: proration });
  }
  await deps.db.saveBilling(orgId, { seats });
  return { synced: true, seats };
}

/** Acciones que la administracion lanza desde la pestaña Suscripcion (llama a la Edge Function `billing`). */
export async function billingAction(action: string, caller: Caller, deps: Deps, input: { sessionId?: string } = {}) {
  const orgId = requireAdmin(caller);
  const row = await deps.db.getBilling(orgId);

  switch (action) {
    case 'checkout': {
      if (row && isPaidStatus(row.status) && row.stripe_subscription_id) {
        throw new BillingError('already_subscribed', 'La empresa ya tiene una suscripción activa. Usa «Gestionar pago y facturas».', 409);
      }
      const seats = seatsToBill(await deps.db.countSeats(orgId));
      const session = await deps.stripe.call('POST', '/checkout/sessions', checkoutParams({ orgId, seats, siteUrl: deps.siteUrl, customerId: row?.stripe_customer_id, email: caller.email }));
      if (!session?.url) throw new BillingError('stripe_no_url', 'Stripe no devolvió la página de pago', 502);
      return { url: session.url as string };
    }
    case 'portal': {
      if (!row?.stripe_customer_id) throw new BillingError('no_customer', 'Todavía no hay datos de pago: contrata primero la suscripción', 409);
      const session = await deps.stripe.call('POST', '/billing_portal/sessions', portalParams({ customerId: row.stripe_customer_id, siteUrl: deps.siteUrl, configuration: deps.portalConfiguration }));
      if (!session?.url) throw new BillingError('stripe_no_url', 'Stripe no devolvió el portal de cliente', 502);
      return { url: session.url as string };
    }
    case 'sync':
      return await syncSeats(orgId, deps, 'create_prorations');
    case 'confirm': {
      // Al volver de Checkout se confirma la sesion sin esperar al webhook (que puede tardar unos segundos)
      if (!input.sessionId || !/^cs_[A-Za-z0-9_]+$/.test(input.sessionId)) throw new BillingError('bad_session', 'Sesión de pago no válida', 400);
      const session = await deps.stripe.call('GET', `/checkout/sessions/${input.sessionId}`);
      if (orgIdFromObject(session) !== orgId) throw new BillingError('forbidden', 'Esta sesión de pago no pertenece a tu empresa', 403);
      if (!session.subscription) return { confirmed: false };
      const sub = await deps.stripe.call('GET', `/subscriptions/${typeof session.subscription === 'string' ? session.subscription : session.subscription.id}`);
      await deps.db.saveBilling(orgId, { ...subscriptionToBilling(sub), last_event_at: new Date().toISOString() });
      return { confirmed: true, status: normalizeStatus(sub.status) };
    }
    default:
      throw new BillingError('bad_action', `Acción desconocida: ${action}`, 400);
  }
}

/** Procesa un evento del webhook de Stripe (ya verificada su firma). Es idempotente y tolera eventos desordenados. */
export async function handleStripeEvent(event: any, deps: Deps): Promise<{ handled: boolean; note?: string }> {
  const type: string = event?.type ?? '';
  const obj = event?.data?.object;
  const created = Number(event?.created) || Math.floor(Date.now() / 1000);

  if (type === 'checkout.session.completed') {
    if (obj?.mode !== 'subscription') return { handled: false, note: 'no es una suscripción' };
    const orgId = orgIdFromObject(obj);
    if (!orgId || !obj.subscription) return { handled: false, note: 'sin empresa o suscripción' };
    const sub = await deps.stripe.call('GET', `/subscriptions/${typeof obj.subscription === 'string' ? obj.subscription : obj.subscription.id}`);
    const current = await deps.db.getBilling(orgId);
    if (!shouldApplyEvent(created, current?.last_event_at)) return { handled: false, note: 'evento antiguo' };
    await deps.db.saveBilling(orgId, { ...subscriptionToBilling(sub), last_event_at: new Date(created * 1000).toISOString() });
    return { handled: true };
  }

  if (type === 'customer.subscription.created' || type === 'customer.subscription.updated' || type === 'customer.subscription.deleted') {
    const customer = typeof obj?.customer === 'string' ? obj.customer : obj?.customer?.id;
    const orgId = orgIdFromObject(obj) ?? (customer ? (await deps.db.getBillingByCustomer(customer))?.id_organization ?? null : null);
    if (!orgId) return { handled: false, note: 'suscripción sin empresa conocida' };
    const current = await deps.db.getBilling(orgId);
    if (!shouldApplyEvent(created, current?.last_event_at)) return { handled: false, note: 'evento antiguo' };
    const patch = subscriptionToBilling(obj);
    if (type === 'customer.subscription.deleted') patch.status = 'canceled';
    await deps.db.saveBilling(orgId, { ...patch, last_event_at: new Date(created * 1000).toISOString() });
    return { handled: true };
  }

  if (type === 'invoice.upcoming') {
    // Unos dias antes de renovar: la cantidad se ajusta a la plantilla actual, sin prorrateo
    const customer = typeof obj?.customer === 'string' ? obj.customer : obj?.customer?.id;
    const row = customer ? await deps.db.getBillingByCustomer(customer) : null;
    if (!row) return { handled: false, note: 'cliente desconocido' };
    await syncSeats(row.id_organization, deps, 'none');
    return { handled: true };
  }

  return { handled: false, note: 'evento ignorado' };
}

/** Cliente minimo de la API de Stripe (REST con cuerpo `application/x-www-form-urlencoded`). */
export function stripeClient(secretKey: string, fetchImpl: typeof fetch = fetch) {
  return {
    async call(method: 'GET' | 'POST', path: string, params?: Record<string, unknown>) {
      const body = params ? formEncode(params) : undefined;
      const url = `https://api.stripe.com/v1${path}${method === 'GET' && body ? `?${body}` : ''}`;
      const res = await fetchImpl(url, {
        method,
        headers: { Authorization: `Bearer ${secretKey}`, ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
        body: method === 'POST' ? body : undefined,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new BillingError('stripe_error', json?.error?.message ?? `Stripe respondió ${res.status}`, 502);
      return json;
    },
  };
}
