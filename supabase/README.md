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
