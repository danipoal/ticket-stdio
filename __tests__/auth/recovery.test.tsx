import * as React from 'react';
import { act, create } from 'react-test-renderer';
import { Platform } from 'react-native';
import { db } from '../../test-utils/supabaseMock';

jest.mock('@/utils/supabase', () => ({
  supabase: require('../../test-utils/supabaseMock').db.client,
  login: jest.fn(),
  signin: jest.fn(),
  requestPasswordReset: (...a: any[]) => mockRequestReset(...a),
  sessionFromLinkTokens: (...a: any[]) => mockSetSession(...a),
  updatePassword: (...a: any[]) => mockUpdatePassword(...a),
}));
const mockRequestReset = jest.fn();
const mockSetSession = jest.fn();
const mockUpdatePassword = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: mockReplace }) }));

import Forgot from '@/app/auth/forgot';
import Reset from '@/app/auth/reset';
import Confirmed from '@/app/auth/confirmed';
import Login from '@/app/auth/login';

// Estas pantallas usan componentes de React Native "planos": no necesitan el provider de gluestack
// (que en modo web exige un DOM real), asi que se montan sin el y se simula window solo si hace falta.
const tick = () => act(async () => { for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0)); });
const mounted: any[] = [];
async function mountPlain(el: React.ReactElement) {
  let r: any;
  await act(async () => { r = create(el); });
  await tick();
  mounted.push(r);
  return r as ReturnType<typeof create>;
}
const txt = (root: any) =>
  root.findAll((n: any) => typeof n.type === 'string').flatMap((n: any) => n.children.filter((c: any) => typeof c === 'string')).join(' ');
const pressId = async (root: any, id: string) => {
  const n = root.findAll((x: any) => x.props.testID === id && typeof x.props.onPress === 'function')[0];
  if (!n) throw new Error('no hay ' + id);
  await act(async () => { await n.props.onPress(); });
  await tick();
};
const typeId = async (root: any, id: string, v: string) => {
  const n = root.findAll((x: any) => x.props.testID === id && typeof x.props.onChangeText === 'function')[0];
  await act(async () => { n.props.onChangeText(v); });
};

const originalOS = Platform.OS;
function setWeb(hash: string) {
  Platform.OS = 'web';
  (global as any).window = { location: { hash, pathname: '/auth/reset', origin: 'https://ticket.danipoal.com' }, history: { replaceState: jest.fn() } };
}

afterEach(async () => {
  // Desmontar: evita que animaciones de TouchableOpacity redibujen cuando el entorno de test ya se ha cerrado
  await act(async () => { mounted.splice(0).forEach((r) => r.unmount()); });
  Platform.OS = originalOS;
  delete (global as any).window;
});
beforeEach(() => {
  jest.clearAllMocks();
  db.reset();
  db.auth.getSession.mockResolvedValue({ data: { session: null } });
});

describe('Forgot (¿Olvidaste tu contraseña?)', () => {
  it('email vacio -> error y no envia', async () => {
    const r = await mountPlain(<Forgot />);
    await pressId(r.root, 'forgot-submit');
    expect(mockRequestReset).not.toHaveBeenCalled();
    expect(txt(r.root)).toContain('El email es obligatorio');
  });
  it('email mal formado -> no envia', async () => {
    const r = await mountPlain(<Forgot />);
    await typeId(r.root, 'forgot-email', 'no-es-email');
    await pressId(r.root, 'forgot-submit');
    expect(mockRequestReset).not.toHaveBeenCalled();
    expect(txt(r.root)).toContain('El email no es válido');
  });
  it('envio correcto: mensaje generico que NO revela si la cuenta existe', async () => {
    mockRequestReset.mockResolvedValue({ ok: true, needsConfirmation: false });
    const r = await mountPlain(<Forgot />);
    await typeId(r.root, 'forgot-email', 'a@b.co');
    await pressId(r.root, 'forgot-submit');
    expect(mockRequestReset).toHaveBeenCalledWith('a@b.co');
    expect(txt(r.root)).toContain('Si existe una cuenta con ese correo');
  });
  it('error del servicio -> se muestra', async () => {
    mockRequestReset.mockResolvedValue({ ok: false, message: 'Demasiados intentos. Espera un momento y vuelve a probar' });
    const r = await mountPlain(<Forgot />);
    await typeId(r.root, 'forgot-email', 'a@b.co');
    await pressId(r.root, 'forgot-submit');
    expect(txt(r.root)).toContain('Demasiados intentos');
  });
  it('doble pulsacion solo envia una vez', async () => {
    let done: (v: any) => void = () => {};
    mockRequestReset.mockReturnValue(new Promise((res) => (done = res)));
    const r = await mountPlain(<Forgot />);
    await typeId(r.root, 'forgot-email', 'a@b.co');
    const tap = () => r.root.findAll((x: any) => x.props.testID === 'forgot-submit' && typeof x.props.onPress === 'function')[0].props.onPress();
    await act(async () => { void tap(); });
    await act(async () => { void tap(); });
    expect(mockRequestReset).toHaveBeenCalledTimes(1);
    await act(async () => { done({ ok: true, needsConfirmation: false }); });
  });
  it('"Volver" lleva al login', async () => {
    const r = await mountPlain(<Forgot />);
    await pressId(r.root, 'forgot-back');
    expect(mockPush).toHaveBeenCalledWith('/auth/login');
  });
});

describe('Login -> enlace de recuperacion', () => {
  it('el login ofrece "¿Olvidaste tu contraseña?" y lleva a /auth/forgot', async () => {
    const r = await mountPlain(<Login />);
    await pressId(r.root, 'login-forgot');
    expect(mockPush).toHaveBeenCalledWith('/auth/forgot');
  });
});

describe('Reset (nueva contraseña)', () => {
  it('REGRESION: enlace caducado en el fragmento -> aviso claro y opcion de pedir otro, sin intentar abrir sesion', async () => {
    setWeb('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
    const r = await mountPlain(<Reset />);
    expect(txt(r.root)).toContain('caducado');
    expect(mockSetSession).not.toHaveBeenCalled();
    await pressId(r.root, 'reset-request-new');
    expect(mockReplace).toHaveBeenCalledWith('/auth/forgot');
  });
  it('sin tokens ni sesion -> enlace no valido', async () => {
    setWeb('');
    const r = await mountPlain(<Reset />);
    expect(txt(r.root)).toContain('no es válido');
  });
  it('sin tokens pero con sesion (recarga de la pagina) -> muestra el formulario', async () => {
    setWeb('');
    db.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    const r = await mountPlain(<Reset />);
    expect(r.root.findAll((n: any) => n.props.testID === 'reset-password').length).toBeGreaterThan(0);
  });
  it('con tokens: abre la sesion, LIMPIA la URL con el router (los tokens no se quedan en el historial) y muestra el formulario', async () => {
    setWeb('#access_token=AT&refresh_token=RT&type=recovery');
    mockSetSession.mockResolvedValue({ ok: true, needsConfirmation: false });
    const r = await mountPlain(<Reset />);
    expect(mockSetSession).toHaveBeenCalledWith('AT', 'RT');
    expect(mockReplace).toHaveBeenCalledWith('/auth/reset'); // la URL se limpia con el router
    expect((global as any).window.history.replaceState).not.toHaveBeenCalled(); // no a mano: expo-router restituiria los tokens
    expect(r.root.findAll((n: any) => n.props.testID === 'reset-password').length).toBeGreaterThan(0);
  });
  it('tokens rechazados por Supabase -> enlace no valido', async () => {
    setWeb('#access_token=AT&refresh_token=RT&type=recovery');
    mockSetSession.mockResolvedValue({ ok: false, message: 'x' });
    const r = await mountPlain(<Reset />);
    expect(txt(r.root)).toContain('Enlace no válido');
  });

  describe('formulario', () => {
    const ready = async () => {
      setWeb('#access_token=AT&refresh_token=RT&type=recovery');
      mockSetSession.mockResolvedValue({ ok: true, needsConfirmation: false });
      return mountPlain(<Reset />);
    };
    it('contraseña corta -> error y no guarda', async () => {
      const r = await ready();
      await typeId(r.root, 'reset-password', '12345');
      await typeId(r.root, 'reset-confirm', '12345');
      await pressId(r.root, 'reset-submit');
      expect(mockUpdatePassword).not.toHaveBeenCalled();
      expect(txt(r.root)).toContain('al menos 6 caracteres');
    });
    it('contraseñas distintas -> error y no guarda', async () => {
      const r = await ready();
      await typeId(r.root, 'reset-password', 'abcdef');
      await typeId(r.root, 'reset-confirm', 'abcdeg');
      await pressId(r.root, 'reset-submit');
      expect(mockUpdatePassword).not.toHaveBeenCalled();
      expect(txt(r.root)).toContain('no coinciden');
    });
    it('campos vacios -> mensajes de obligatorio', async () => {
      const r = await ready();
      await pressId(r.root, 'reset-submit');
      expect(txt(r.root)).toContain('La contraseña es obligatoria');
      expect(txt(r.root)).toContain('Repite la contraseña');
    });
    it('guardado correcto -> "Contraseña actualizada" y continuar lleva a la home', async () => {
      mockUpdatePassword.mockResolvedValue({ ok: true, needsConfirmation: false });
      const r = await ready();
      await typeId(r.root, 'reset-password', 'nueva-clave');
      await typeId(r.root, 'reset-confirm', 'nueva-clave');
      await pressId(r.root, 'reset-submit');
      expect(mockUpdatePassword).toHaveBeenCalledWith('nueva-clave');
      expect(txt(r.root)).toContain('Contraseña actualizada');
      await pressId(r.root, 'reset-continue');
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)/home');
    });
    it('error del servicio (misma contraseña) -> se muestra y se puede reintentar', async () => {
      mockUpdatePassword.mockResolvedValue({ ok: false, message: 'La nueva contraseña debe ser distinta de la anterior' });
      const r = await ready();
      await typeId(r.root, 'reset-password', 'misma-clave');
      await typeId(r.root, 'reset-confirm', 'misma-clave');
      await pressId(r.root, 'reset-submit');
      expect(txt(r.root)).toContain('distinta de la anterior');
      expect(r.root.findAll((n: any) => n.props.testID === 'reset-submit').length).toBeGreaterThan(0);
    });
  });
});

describe('Confirmed (correo confirmado)', () => {
  it('sin tokens: mensaje de correo confirmado y boton al login', async () => {
    setWeb('');
    const r = await mountPlain(<Confirmed />);
    expect(txt(r.root)).toContain('Correo confirmado');
    expect(mockSetSession).not.toHaveBeenCalled();
    await pressId(r.root, 'confirmed-login');
    expect(mockReplace).toHaveBeenCalledWith('/auth/login');
  });
  it('con tokens: abre la sesion (el guardia de rutas lleva al alta del perfil) y limpia la URL', async () => {
    setWeb('#access_token=AT&refresh_token=RT&type=signup');
    mockSetSession.mockResolvedValue({ ok: true, needsConfirmation: false });
    await mountPlain(<Confirmed />);
    expect(mockSetSession).toHaveBeenCalledWith('AT', 'RT');
    expect(mockReplace).toHaveBeenCalledWith('/auth/confirmed');
  });
  it('enlace caducado: lo dice y no abre sesion', async () => {
    setWeb('#error=access_denied&error_code=otp_expired&error_description=expired');
    const r = await mountPlain(<Confirmed />);
    expect(txt(r.root)).toContain('No se pudo confirmar');
    expect(mockSetSession).not.toHaveBeenCalled();
  });
});
