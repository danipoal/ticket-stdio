import { friendlyAuthError } from '../authErrors';

describe('friendlyAuthError', () => {
  it.each([
    ['Invalid login credentials', 'Email o contraseña incorrectos'],
    ['Email not confirmed', 'Debes confirmar tu email antes de entrar'],
    ['User already registered', 'Este email ya está registrado'],
    ['Password should be at least 6 characters.', 'La contraseña es demasiado corta'],
    ['Email rate limit exceeded', 'Demasiados intentos. Espera un momento y vuelve a probar'],
    ['TypeError: Failed to fetch', 'No se pudo conectar con el servidor. Revisa tu conexión'],
    ['Unable to validate email address: invalid format', 'El email no es válido'],
  ])('%s', (input, expected) => {
    expect(friendlyAuthError(input)).toBe(expected);
  });

  it('mensaje desconocido o vacio -> generico, sin filtrar texto interno', () => {
    for (const x of ['pg_catalog exploded: secret_table', '', null, undefined]) {
      const out = friendlyAuthError(x as any);
      expect(out).toBe('No se pudo completar la operación. Inténtalo de nuevo');
      expect(out).not.toContain('secret_table');
    }
  });
});
