/**
 * Traduce los mensajes de Supabase Auth (en ingles) a mensajes para el usuario.
 * Si no se reconoce el mensaje se devuelve uno generico: no mostramos texto
 * interno del backend.
 */
export function friendlyAuthError(message: string | undefined | null): string {
  const m = (message ?? '').toLowerCase();
  if (m.includes('invalid login credentials')) return 'Email o contraseña incorrectos';
  if (m.includes('email not confirmed')) return 'Debes confirmar tu email antes de entrar';
  if (m.includes('user already registered') || m.includes('already been registered')) {
    return 'Este email ya está registrado';
  }
  if (m.includes('password should be at least')) return 'La contraseña es demasiado corta';
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Demasiados intentos. Espera un momento y vuelve a probar';
  }
  if (m.includes('same password') || m.includes('different from the old')) return 'La nueva contraseña debe ser distinta de la anterior';
  if (m.includes('session') && (m.includes('missing') || m.includes('expired'))) return 'El enlace ha caducado. Pide uno nuevo';
  if (m.includes('failed to fetch') || m.includes('network')) {
    return 'No se pudo conectar con el servidor. Revisa tu conexión';
  }
  if (m.includes('invalid email') || m.includes('unable to validate email')) {
    return 'El email no es válido';
  }
  return 'No se pudo completar la operación. Inténtalo de nuevo';
}
