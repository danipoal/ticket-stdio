// Edge Function `billing` (verify_jwt = true): acciones de la pestaña Suscripcion, solo para la administracion de la empresa.
//   POST { action: 'checkout' | 'portal' | 'sync' | 'confirm', sessionId? }  ->  { url } | { synced, seats } | { confirmed }
// Secretos (supabase secrets): STRIPE_SECRET_KEY, SITE_URL (opcional), STRIPE_PORTAL_CONFIGURATION (opcional).
// La logica esta en ../_shared/stripe.ts; el script supabase/apply-billing.py la incluye en el fichero que se despliega.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { BillingError, billingAction, stripeClient, type BillingRow, type Deps } from '../_shared/stripe.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  try {
    const secretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!secretKey) return json(200, { error: 'not_configured', message: 'La pasarela de pago todavía no está configurada' });

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

    // Identidad: el JWT del usuario (la plataforma ya lo ha validado; aqui se recupera quien es y su empresa)
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: userData, error: userError } = await admin.auth.getUser(jwt);
    if (userError || !userData.user) return json(401, { error: 'unauthorized', message: 'Sesión no válida' });
    const { data: emp } = await admin.from('employees').select('id, is_admin, id_organization').eq('id_user', userData.user.id).maybeSingle();

    const body = await req.json().catch(() => ({}));
    const deps: Deps = {
      stripe: stripeClient(secretKey),
      siteUrl: Deno.env.get('SITE_URL') ?? 'https://ticket.danipoal.com',
      portalConfiguration: Deno.env.get('STRIPE_PORTAL_CONFIGURATION'),
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

    const result = await billingAction(String(body.action ?? ''), { orgId: emp?.id_organization ?? null, isAdmin: !!emp?.is_admin, email: userData.user.email }, deps, { sessionId: body.sessionId });
    return json(200, result);
  } catch (e) {
    if (e instanceof BillingError) return json(e.http, { error: e.code, message: e.message });
    console.error('billing', e);
    return json(500, { error: 'internal', message: 'Error interno de facturación' });
  }
});
