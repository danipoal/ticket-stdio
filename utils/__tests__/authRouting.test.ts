import { routeForState } from '../authRouting';

const s = (pathname: string, hasSession: boolean, hasEmployee: boolean) =>
  routeForState({ pathname, hasSession, hasEmployee });

describe('routeForState', () => {
  describe('sin sesion', () => {
    it.each(['/auth/login', '/auth/signin', '/auth/completeProfile'])('%s: se queda', (p) => {
      expect(s(p, false, false)).toBeNull();
    });
    it.each(['/', '/home', '/tickets', '/settings', '/user', '/(tabs)/home'])('%s: va a login', (p) => {
      expect(s(p, false, false)).toBe('/auth/login');
    });
  });

  describe('con sesion y sin empleado', () => {
    it('debe completar el perfil desde cualquier sitio', () => {
      for (const p of ['/', '/home', '/tickets', '/auth/login', '/auth/signin']) {
        expect(s(p, true, false)).toBe('/auth/completeProfile');
      }
    });
    it('en completeProfile se queda', () => {
      expect(s('/auth/completeProfile', true, false)).toBeNull();
    });
  });

  describe('con sesion y empleado', () => {
    it.each(['/home', '/tickets', '/settings', '/user'])('%s: se queda', (p) => {
      expect(s(p, true, true)).toBeNull();
    });
    it.each(['/auth/login', '/auth/signin', '/auth/completeProfile', '/auth'])('%s: a la home', (p) => {
      expect(s(p, true, true)).toBe('/(tabs)/home');
    });
  });

  it('una ruta que solo empieza por "auth" no cuenta como /auth/', () => {
    expect(s('/authors', false, false)).toBe('/auth/login');
  });
});
