// Prueba que se ejecuta con Deno (no con Jest): `deno test --allow-env supabase/functions/_shared/stripe.deno-test.ts`.
// Comprueba que la verificacion de firma usa WebCrypto igual que Stripe (firma calculada fuera, en Python) y que el cuerpo
// del Checkout se codifica como espera la API.
import { formEncode, checkoutParams, verifyStripeSignature } from './stripe.ts';

const assert = (cond: unknown, msg: string) => { if (!cond) throw new Error(msg); };

Deno.test('firma de Stripe calculada con una implementacion independiente', async () => {
  const secret = Deno.env.get('TEST_SECRET') ?? '';
  const t = Number(Deno.env.get('TEST_T'));
  const sig = Deno.env.get('TEST_SIG') ?? '';
  const payload = Deno.env.get('TEST_PAYLOAD') ?? '';
  assert(secret && sig && t, 'faltan variables TEST_*');
  assert(await verifyStripeSignature(payload, `t=${t},v1=${sig}`, secret, t + 10), 'la firma valida debe aceptarse');
  assert(!(await verifyStripeSignature(payload + 'x', `t=${t},v1=${sig}`, secret, t + 10)), 'cuerpo alterado debe rechazarse');
  assert(!(await verifyStripeSignature(payload, `t=${t},v1=${sig}`, secret, t + 10_000)), 'firma antigua debe rechazarse');
});

Deno.test('cuerpo de la sesion de Checkout', () => {
  const body = decodeURIComponent(formEncode(checkoutParams({ orgId: 7, seats: 6, siteUrl: 'https://x.test' })));
  assert(body.includes('line_items[0][quantity]=6'), 'cantidad = trabajadores');
  assert(body.includes('line_items[0][price_data][unit_amount]=200'), '2 EUR');
  assert(body.includes('line_items[0][price_data][recurring][interval]=month'), 'mensual');
  assert(body.includes('client_reference_id=7'), 'empresa');
});
