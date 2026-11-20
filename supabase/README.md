# Supabase

Proyecto `Stdio Ticket` (`zyiegqaaeltcgazcvbfs`). Los cambios de esquema y seguridad van como migraciones SQL en
`supabase/migrations/`, con este orden y criterio:

1. Copia de seguridad de los datos antes de aplicar.
2. Simulacro en una transaccion que siempre se deshace, con pruebas que suplantan a usuarios reales
   (`auth.uid()` via `request.jwt.claims` + `set local role authenticated`).
3. Aplicar en una sola transaccion y repetir las pruebas sobre el estado real.

## Modelo de seguridad (fase 2)

- `auth.uid()` = `employees.id_user`; `employees.id` es la clave que usan `Expense_sheet.id_user` y `employees.id_admin`.
- Cada empleado ve y edita solo lo suyo. Un administrador ve las hojas de las personas a las que aprueba.
- Quien aprueba a un empleado (`public.can_manage`): su `id_admin`; si no tiene, cualquier administrador de su organizacion;
  un administrador sin jefe y sin otro administrador en su organizacion se aprueba a si mismo.
- Estados: 1 Pendiente, 2 Aprobado, 3 Rechazado. Aprobador: 1->2 y 1->3. Propietario: 3->1 (reenviar). Una hoja aprobada es definitiva.
  La fecha de aprobacion la fija la base de datos. Las lineas solo las modifica el propietario con la hoja pendiente.
- `Organization` es legible por usuarios con sesion de forma TEMPORAL (la app valida el codigo de empresa por VAT);
  se cerrara con un codigo de invitacion en la fase 3.
- Fuera de un contexto de usuario (SQL editor, service_role) los triggers no restringen: se pueden corregir estados a mano.

## Fase 3 (aplicada el 2026-11-19)

- **Integridad**: importes y IVA en `numeric`, restricciones (importe > 0, IVA 0-100, titulos no vacios) e indices en las claves foraneas.
- **Auditoria**: `reference` (HG-NNNNNN), `updated_at`, `reviewed_by/at`, `review_note` (motivo, lo escribe quien revisa al aprobar o
  rechazar) e historial de estados `Sheet_status_history` (lo escribe solo la base de datos, con el nombre de quien actuo).
- **Base ERP**: `Expense_category.account_code`, `Expense_payment_type.erp_code`, `erp_id` en hojas/lineas/empleados/organizaciones,
  `currency`, `cost_center`, la cola `erp_outbox` (solo `service_role`; un trigger anade `sheet.approved` al aprobar una hoja)
  y `sheet_export(id)` con el JSON completo. SUPUESTO: `amount` es el total CON IVA; base e IVA se derivan del porcentaje.
  Un conector debe leer `erp_outbox` con `select ... where processed_at is null order by id for update skip locked`
  y marcar `processed_at` / `attempts` / `last_error`.
- **Alta de empleados**: `organization_by_code(codigo)` y `join_organization(codigo, nombre)`; el administrador ve su codigo con
  `my_invite_code()`. `Organization` solo es legible para la propia organizacion y sin `invite_code`/`erp_id`
  (la web debe pedir columnas explicitas: `select *` no esta permitido). No hay INSERT directo en `employees`.
- **Adjuntos**: bucket `tickets` privado. La ruta se guarda en `Expense_line.foto_path` y se abre con URL firmada; las politicas de
  `storage.objects` siguen la visibilidad de la hoja (`expense-lines/<id_hoja>/...`). Escribir solo el propietario con la hoja pendiente.
- Existe un esquema heredado `views` (sin permisos para la API); su vista depende de `amount` y se recreo con el nuevo tipo.
- `Expense_account` queda obsoleta: usar `Expense_category.account_code`.

Pendiente: verificacion de correo (SMTP propio), proteccion contra contrasenas filtradas y un conector real que consuma `erp_outbox`.

## Suscripcion y limite de tickets (fase 4)

- **Regla**: cada empresa tiene **50 tickets (hojas de gasto) gratis**. Con suscripcion no hay limite. El contador
  `organization_billing.tickets_created` solo sube: **borrar una hoja no devuelve el cupo** (los borrados cuentan).
  Pasado el limite sin suscripcion, `insert` en `Expense_sheet` falla con SQLSTATE `PT402` (HTTP 402, `ticket_limit_reached`) y la
  app bloquea "Nueva hoja" con un aviso para toda la empresa (consultar lo existente sigue funcionando).
- **Precio**: 2 EUR/mes por trabajador (empleado de la empresa); la cantidad de la suscripcion es el numero de empleados.
  Solo la administracion de la empresa contrata y gestiona (pestaña **Suscripcion**).
- **Quien cuenta como de pago**: `active`, `trialing` y `past_due` (gracia mientras Stripe reintenta el cobro). `canceled`, `unpaid`,
  `incomplete*`, `paused` y `none` vuelven al limite gratuito.
- **Tabla** `organization_billing` (sin acceso desde la web, ni para administradores): contador, `free_limit` (por defecto 50, se puede
  subir a mano para una empresa concreta), ids de Stripe, estado, plazas, fin de periodo. La web lee el estado con la RPC `billing_status()`
  (todos los miembros: uso, limite, `can_create`; la administracion ademas ve plazas y cuota).
- **Trigger** `expense_sheet_quota` (BEFORE INSERT en `Expense_sheet`, `SECURITY DEFINER`, fila bloqueada con `FOR UPDATE`): cuenta y
  rechaza. SQL directo / `service_role` pueden crear hojas pero tambien consumen cupo.
- **Edge Functions** (`supabase/functions/`, la logica comun en `_shared/stripe.ts`, probada con Jest y con Deno):
  - `billing` (JWT obligatorio, solo administracion): `checkout` (Stripe Checkout, precio en linea 2 EUR x trabajadores), `portal`
    (portal de cliente: tarjeta, facturas y baja al final del periodo), `sync` (ajusta la cantidad a la plantilla) y `confirm`
    (al volver de Checkout, sin esperar al webhook).
  - `stripe-webhook` (sin JWT: se verifica la firma `Stripe-Signature`, tolerancia 5 min): mantiene `organization_billing` al dia con
    `checkout.session.completed`, `customer.subscription.*` e `invoice.upcoming` (ajusta las plazas antes de renovar). Es idempotente y
    descarta eventos desordenados.
  - Secretos (en Supabase, nunca en el repo): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PORTAL_CONFIGURATION`, `SITE_URL`.
    Sin clave de Stripe las funciones responden `not_configured` y la pestaña lo explica.
- **Despliegue**: `python3 supabase/apply-billing.py --dry-run` (construye y valida con Deno en Docker; tambien lo ejecuta el CI),
  `--functions-only` (solo funciones) y sin opciones (funciones + webhook + portal + secretos si existe `~/.config/stripe-key`).
  Para pasar de modo prueba a real: poner la clave `sk_live_...` en `~/.config/stripe-key` y repetir (crea webhook y portal en la cuenta real).
- **Como probar una migracion**: concatenar el SQL de la migracion con `supabase/tests/fase4_suscripcion.sql` y enviarlo en una sola
  peticion (`sbq.py --write -f`): las pruebas suplantan usuarios reales y terminan en una excepcion que deshace todo
  (`DRYRUN_OK: N comprobaciones superadas`).
- **Supuestos a revisar**: el limite cuenta HOJAS (no lineas); el precio es 2 EUR sin tratamiento de IVA en Stripe (no hay Stripe Tax
  configurado: si procede cobrar IVA, activarlo en Stripe y revisar la factura); no hay prueba gratuita ademas de los 50 tickets.

## Correo (Supabase Auth)

- Remitente `ticket@danipoal.com` ("Ticket Stdio"). Supabase envia por **Resend** (`smtp.resend.com:465`, usuario `resend`)
  con una clave de API propia y revocable; las respuestas llegan al buzon `ticket@danipoal.com` del Poste.io del servidor.
  (Los puertos SMTP de Poste no son accesibles desde la nube porque `mail.`/`email.danipoal.com` estan tras el proxy de Cloudflare.)
- `supabase/email-config.json` (asuntos, URLs permitidas, limites) y `supabase/email-templates/*.html` (plantillas en castellano)
  se aplican con `python3 supabase/apply-email-config.py [--dry-run] [--require-confirmation]`. La clave de Resend se lee de
  `~/.config/resend-ticket-key` (o `RESEND_API_KEY`); no esta en el repositorio.
- Flujos de la app: registro con confirmacion de correo (`/auth/confirmed`), "¿Olvidaste tu contrasena?" (`/auth/forgot`) y
  nueva contrasena desde el enlace (`/auth/reset`). Los tokens del enlace llegan en el fragmento de la URL
  (`#access_token=...`); expo-router incluye ese fragmento en `usePathname()`, por eso el guardia de rutas compara solo la ruta.
