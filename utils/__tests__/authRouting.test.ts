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

  describe('/auth/reset (enlace de recuperacion)', () => {
    it('con sesion y empleado NO se expulsa a la home: hay que elegir la nueva contraseña', () => {
      expect(s('/auth/reset', true, true)).toBeNull();
    });
    it('con sesion sin ficha tampoco se desvia a completar el perfil', () => {
      expect(s('/auth/reset', true, false)).toBeNull();
    });
    it('sin sesion es una pagina de /auth: se queda', () => {
      expect(s('/auth/reset', false, false)).toBeNull();
    });
    it('otras rutas de /auth siguen yendo a la home con sesion', () => {
      expect(s('/auth/confirmed', true, true)).toBe('/(tabs)/home');
      expect(s('/auth/login', true, true)).toBe('/(tabs)/home');
    });
    it('REGRESION: con la sesion abierta /auth/forgot SE PUEDE usar (el enlace caducado lleva ahi y el guardia lo devolvia a la home sin enviar nada)', () => {
      expect(s('/auth/forgot', true, true)).toBeNull();
      expect(s('/auth/forgot', true, false)).toBeNull();
      expect(s('/auth/forgot#x', true, true)).toBeNull();
    });
    it('/auth/confirmed y /auth/forgot son accesibles sin sesion', () => {
      expect(s('/auth/confirmed', false, false)).toBeNull();
      expect(s('/auth/forgot', false, false)).toBeNull();
    });
  });

  describe('la ruta puede traer fragmento o query (expo-router en web)', () => {
    it('REGRESION: /auth/reset#access_token=... no se expulsa a la home (el enlace de recuperacion se rompia)', () => {
      expect(s('/auth/reset#access_token=AAA&refresh_token=BBB&type=recovery', true, true)).toBeNull();
      expect(s('/auth/reset?x=1', true, true)).toBeNull();
    });
    it('el resto de comparaciones tambien ignoran fragmento y query', () => {
      expect(s('/auth/login#algo', true, true)).toBe('/(tabs)/home');
      expect(s('/auth/completeProfile?x=1', true, false)).toBeNull();
      expect(s('/tickets#x', false, false)).toBe('/auth/login');
      expect(s('/auth/signin?x=1#y', false, false)).toBeNull();
    });
    it('ruta vacia -> "/"', () => {
      expect(s('#solo-fragmento', false, false)).toBe('/auth/login');
    });
  });
});
