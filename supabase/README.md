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
