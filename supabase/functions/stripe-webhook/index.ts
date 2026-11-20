// Edge Function `stripe-webhook` (verify_jwt = false: la autenticidad se comprueba con la firma de Stripe).
// Recibe los eventos de Stripe y mantiene `organization_billing` al dia (estado, plazas, fin de periodo).
// Secretos: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET (el `whsec_...` del endpoint).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { BillingError, handleStripeEvent, stripeClient, verifyStripeSignature, type BillingRow, type Deps } from '../_shared/stripe.ts';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const secretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!secretKey || !webhookSecret) return json(503, { error: 'not_configured' });

  // El cuerpo se firma tal cual llega: hay que leerlo como texto antes de interpretarlo
  const payload = await req.text();
  if (!(await verifyStripeSignature(payload, req.headers.get('Stripe-Signature'), webhookSecret))) return json(400, { error: 'bad_signature' });

  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const deps: Deps = {
      stripe: stripeClient(secretKey),
      siteUrl: Deno.env.get('SITE_URL') ?? 'https://ticket.danipoal.com',
      db: {
        async getBilling(orgId) {
          const { data } = await admin.from('organization_billing').select('*').eq('id_organization', orgId).maybeSingle();
          return (data as BillingRow) ?? null;
        },
        async getBillingByCustomer(customerId) {
          const { data } = await admin.from('organization_billing').select('*').eq('stripe_customer_id', customerId).maybeSingle();
          return (data as BillingRow) ?? null;
        },
        async saveBilling(orgId, patch) {
          const { error } = await admin.from('organization_billing').upsert({ id_organization: orgId, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'id_organization' });
          if (error) throw new BillingError('db_error', error.message, 500);
        },
        async countSeats(orgId) {
          const { count } = await admin.from('employees').select('id', { count: 'exact', head: true }).eq('id_organization', orgId);
          return count ?? 0;
        },
      },
    };
    const result = await handleStripeEvent(JSON.parse(payload), deps);
    return json(200, { received: true, ...result });
  } catch (e) {
    // 500: Stripe reintenta el evento mas tarde
    console.error('stripe-webhook', e);
    return json(500, { error: e instanceof BillingError ? e.code : 'internal' });
  }
});
