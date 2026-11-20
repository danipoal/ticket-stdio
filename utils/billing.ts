import { supabase } from '@/utils/supabase';
import { formatAmount, formatDateSafe } from '@/utils/format';

/** Estado de facturacion de la empresa (RPC `billing_status`, visible para todos sus miembros). */
export type BillingStatus = {
  organization_id: number;
  is_admin: boolean;
  /** Tickets (hojas) creados desde siempre: los borrados tambien cuentan. */
  used: number;
  free_limit: number;
  remaining: number;
  /** true con suscripcion activa (o en gracia): sin limite. */
  paid: boolean;
  status: string;
  can_create: boolean;
  /** Trabajadores de la empresa ahora mismo. */
  seats: number;
  /** Plazas que Stripe esta cobrando. */
  billed_seats: number;
  price_per_seat_cents: number;
  monthly_cents: number;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

/** Cuando faltan este numero de tickets o menos se avisa a todos de que se acaba el cupo gratuito. */
export const LOW_REMAINING_THRESHOLD = 5;

export const eur = (cents: number | null | undefined) => `${formatAmount((Number(cents) || 0) / 100)} €`;

/** Error de la base de datos al crear una hoja sin cupo (SQLSTATE PT402 -> HTTP 402). */
export function isLimitError(err: any): boolean {
  if (!err) return false;
  return err.code === 'PT402' || err.status === 402 || /ticket_limit_reached/i.test(String(err.message ?? ''));
}

export type LimitLevel = 'ok' | 'low' | 'blocked';
export function limitLevel(s: BillingStatus | null | undefined): LimitLevel {
  if (!s || s.paid) return 'ok';
  if (!s.can_create) return 'blocked';
  return s.remaining <= LOW_REMAINING_THRESHOLD ? 'low' : 'ok';
}

export function limitMessage(s: BillingStatus, isAdmin: boolean): string {
  if (limitLevel(s) === 'blocked') {
    return isAdmin
      ? `Vuestra empresa ha agotado los ${s.free_limit} tickets gratuitos (los borrados también cuentan). Activa la suscripción para seguir creando tickets.`
      : `Tu empresa ha agotado los ${s.free_limit} tickets gratuitos, así que no se pueden crear más. Avisa a la administración para que active la suscripción.`;
  }
  return `Quedan ${s.remaining} ${s.remaining === 1 ? 'ticket gratuito' : 'tickets gratuitos'} de ${s.free_limit}. ${isAdmin ? 'Activa la suscripción para no tener límite.' : 'Después hará falta la suscripción de la empresa.'}`;
}

export const usagePercent = (s: Pick<BillingStatus, 'used' | 'free_limit'>) =>
  s.free_limit <= 0 ? 100 : Math.max(0, Math.min(100, Math.round((s.used / s.free_limit) * 100)));

export type PlanTone = 'neutral' | 'success' | 'warning' | 'danger';
/** Etiqueta del plan para la pestaña Suscripcion. */
export function planLabel(s: BillingStatus): { label: string; tone: PlanTone; detail: string } {
  if (s.paid && s.status === 'past_due') return { label: 'Pago pendiente', tone: 'warning', detail: 'No se ha podido cobrar la última cuota. Actualiza el método de pago para no perder el acceso.' };
  if (s.paid && s.cancel_at_period_end) return { label: 'Se cancela al final del periodo', tone: 'warning', detail: s.current_period_end ? `Seguirá activa hasta el ${formatDateSafe(s.current_period_end)}.` : 'Seguirá activa hasta el final del periodo pagado.' };
  if (s.paid) return { label: 'Suscripción activa', tone: 'success', detail: s.current_period_end ? `Próxima renovación: ${formatDateSafe(s.current_period_end)}.` : 'Sin límite de tickets.' };
  if (s.status === 'canceled' || s.status === 'unpaid' || s.status === 'incomplete_expired') return { label: 'Suscripción cancelada', tone: 'danger', detail: 'La empresa vuelve al plan gratuito (límite de tickets).' };
  if (!s.can_create) return { label: 'Plan gratuito agotado', tone: 'danger', detail: 'No se pueden crear más tickets hasta activar la suscripción.' };
  return { label: 'Plan gratuito', tone: 'neutral', detail: `Incluye ${s.free_limit} tickets por empresa.` };
}

/** Texto de la cuota: `6 trabajadores × 2,00 € = 12,00 € al mes`. */
export function priceBreakdown(s: Pick<BillingStatus, 'seats' | 'price_per_seat_cents' | 'monthly_cents'>): string {
  const n = Math.max(1, s.seats);
  return `${n} ${n === 1 ? 'trabajador' : 'trabajadores'} × ${eur(s.price_per_seat_cents)} = ${eur(s.monthly_cents)} al mes`;
}

export type InvokeResult = { ok: true; data: any } | { ok: false; code: string; message: string };

/** Llama a la Edge Function `billing` y normaliza los errores (la funcion responde con {error, message}). */
export async function invokeBilling(action: 'checkout' | 'portal' | 'sync' | 'confirm', extra: Record<string, unknown> = {}): Promise<InvokeResult> {
  const fallback = { ok: false as const, code: 'network', message: 'No se pudo contactar con el servicio de pagos. Inténtalo de nuevo.' };
  try {
    const { data, error } = await supabase.functions.invoke('billing', { body: { action, ...extra } });
    if (error) {
      const ctx = (error as any).context;
      if (ctx && typeof ctx.json === 'function') {
        try {
          const j = await ctx.json();
          return { ok: false, code: j?.error ?? 'error', message: j?.message ?? fallback.message };
        } catch {
          /* cuerpo no JSON */
        }
      }
      return fallback;
    }
    if (data?.error) return { ok: false, code: data.error, message: data.message ?? fallback.message };
    return { ok: true, data };
  } catch {
    return fallback;
  }
}
