import * as React from 'react';
import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';
import { db } from '../../test-utils/supabaseMock';

jest.mock('@/utils/supabase', () => ({ supabase: require('../../test-utils/supabaseMock').db.client }));

const mockReplace = jest.fn();
let mockPath = '/home';
let mockNavKey: string | undefined = 'root';
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => mockPath,
  useRootNavigationState: () => ({ key: mockNavKey }),
}));

import AuthProvider from '../AuthContext';
import useAuth from '../useAuth';

const user = { id: 'u1', email: 'a@b.co' };
const session = { user, access_token: 't' };
const employee = { id: 'e1', name: 'Ana', is_admin: false, id_organization: 'o1', id_user: 'u1' };

let latest: ReturnType<typeof useAuth> | null = null;
function Probe() {
  latest = useAuth();
  return <Text>{latest.employee?.name ?? 'sin-empleado'}</Text>;
}

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
async function mount() {
  let r: any;
  await act(async () => { r = create(<AuthProvider><Probe /></AuthProvider>); });
  await flush();
  return r;
}
const rendered = (r: any) => JSON.stringify(r.toJSON());

describe('AuthProvider', () => {
  let unsubscribe: jest.Mock;
  let authCallback: ((e: string, s: any) => void) | null;

  beforeEach(() => {
    jest.clearAllMocks();
    db.reset();
    latest = null;
    mockPath = '/home';
    mockNavKey = 'root';
    unsubscribe = jest.fn();
    authCallback = null;
    db.auth.getSession.mockResolvedValue({ data: { session: null } });
    db.auth.onAuthStateChange.mockImplementation(((cb: any) => {
      authCallback = cb;
      return { data: { subscription: { unsubscribe } } };
    }) as any);
  });

  it('muestra spinner mientras carga y luego los hijos', async () => {
    const r = await mount();
    expect(rendered(r)).toContain('sin-empleado');
  });

  it('sin sesion en ruta protegida -> login', async () => {
    await mount();
    expect(mockReplace).toHaveBeenCalledWith('/auth/login');
  });

  it('sin sesion en /auth/signin NO se expulsa a login (regresion)', async () => {
    mockPath = '/auth/signin';
    await mount();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('con sesion y empleado carga el empleado y no redirige desde /home', async () => {
    db.auth.getSession.mockResolvedValue({ data: { session } });
    db.on('employees', 'select', { data: employee });
    const r = await mount();
    expect(rendered(r)).toContain('Ana');
    expect(latest?.user?.id).toBe('u1');
    expect(mockReplace).not.toHaveBeenCalled();
    const q = db.calls.find((c) => c.table === 'employees');
    expect(q?.filters).toEqual([['id_user', 'u1']]);
  });

  it('con sesion y empleado en /auth/login -> home', async () => {
    mockPath = '/auth/login';
    db.auth.getSession.mockResolvedValue({ data: { session } });
    db.on('employees', 'select', { data: employee });
    await mount();
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/home');
  });

  it('con sesion pero sin ficha de empleado -> completar perfil, sin error en consola', async () => {
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    db.auth.getSession.mockResolvedValue({ data: { session } });
    db.on('employees', 'select', { data: null, error: null });
    await mount();
    expect(mockReplace).toHaveBeenCalledWith('/auth/completeProfile');
    expect(err).not.toHaveBeenCalled();
    err.mockRestore();
  });

  it('un error al cargar el empleado deja employee en null y no rompe', async () => {
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    db.auth.getSession.mockResolvedValue({ data: { session } });
    db.on('employees', 'select', { error: { message: 'boom' } });
    const r = await mount();
    expect(rendered(r)).toContain('sin-empleado');
    err.mockRestore();
  });

  it('si getSession falla la app no se queda en el spinner para siempre (regresion)', async () => {
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    db.auth.getSession.mockRejectedValue(new Error('network'));
    const r = await mount();
    expect(rendered(r)).toContain('sin-empleado');
    err.mockRestore();
  });

  it('se desuscribe de onAuthStateChange al desmontar (regresion: fuga)', async () => {
    const r = await mount();
    expect(unsubscribe).not.toHaveBeenCalled();
    act(() => r.unmount());
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('se suscribe una sola vez', async () => {
    await mount();
    expect(db.auth.onAuthStateChange).toHaveBeenCalledTimes(1);
  });

  it('no navega hasta que el navegador raiz esta listo', async () => {
    mockNavKey = undefined;
    await mount();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('login posterior: no pasa por completeProfile mientras se carga el empleado (regresion parpadeo)', async () => {
    mockPath = '/auth/login';
    let release: (v: any) => void = () => {};
    db.on('employees', 'select', () => ({ data: employee }));
    await mount();
    mockReplace.mockClear();
    // Ahora llega la sesion por el listener de supabase
    await act(async () => { authCallback?.('SIGNED_IN', session); });
    await flush();
    const targets = mockReplace.mock.calls.map((c) => c[0]);
    expect(targets).not.toContain('/auth/completeProfile');
    expect(targets).toContain('/(tabs)/home');
    void release;
  });

  it('logout (sesion null desde el listener) limpia el empleado y vuelve a login', async () => {
    db.auth.getSession.mockResolvedValue({ data: { session } });
    db.on('employees', 'select', { data: employee });
    const r = await mount();
    expect(rendered(r)).toContain('Ana');
    mockReplace.mockClear();
    await act(async () => { authCallback?.('SIGNED_OUT', null); });
    await flush();
    expect(rendered(r)).toContain('sin-empleado');
    expect(mockReplace).toHaveBeenCalledWith('/auth/login');
  });

  it('no escribe la sesion (tokens) en AsyncStorage (regresion: duplicado de tokens)', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    db.auth.getSession.mockResolvedValue({ data: { session } });
    db.on('employees', 'select', { data: employee });
    await mount();
    const keys = (await AsyncStorage.getAllKeys()) as string[];
    expect(keys).not.toContain('session');
  });
});

describe('AuthProvider · pantalla de carga', () => {
  let authCallback: ((e: string, s: any) => void) | null;
  const splash = (r: any) => r.root.findAll((n: any) => typeof n.type === 'string' && n.props.testID === 'boot-splash');
  const label = (r: any) => r.root.findAll((n: any) => typeof n.type === 'string' && n.props.testID === 'boot-label')[0]?.children.join('');
  const press = async (r: any, id: string) => {
    const el = r.root.findAll((n: any) => n.props.testID === id && typeof n.props.onPress === 'function')[0];
    await act(async () => { await el.props.onPress(); });
    await flush();
  };
  const settle = () => act(async () => { await new Promise((res) => setTimeout(res, 450)); });

  beforeEach(() => {
    jest.clearAllMocks();
    db.reset();
    mockPath = '/home';
    mockNavKey = 'root';
    authCallback = null;
    db.auth.getSession.mockResolvedValue({ data: { session: null } });
    db.auth.onAuthStateChange.mockImplementation(((cb: any) => { authCallback = cb; return { data: { subscription: { unsubscribe: jest.fn() } } }; }) as any);
  });

  it('mientras se comprueba la sesion enseña "Comprobando tu sesión…" y NO monta la app', async () => {
    db.auth.getSession.mockReturnValue(new Promise(() => {}) as any);
    const r = await mount();
    expect(splash(r)).toHaveLength(1);
    expect(label(r)).toBe('Comprobando tu sesión…');
    expect(rendered(r)).not.toContain('sin-empleado'); // los hijos aun no estan montados
  });

  it('con sesion enseña "Cargando tu empresa…" hasta que llega la ficha, y luego se retira', async () => {
    let release: (v: any) => void = () => {};
    db.auth.getSession.mockResolvedValue({ data: { session } });
    db.on('employees', 'select', () => new Promise((res) => { release = res; }));
    const r = await mount();
    expect(label(r)).toBe('Cargando tu empresa…');
    expect(mockReplace).not.toHaveBeenCalled();
    await act(async () => { release({ data: employee }); });
    await flush();
    await settle();
    expect(rendered(r)).toContain('Ana');
    expect(splash(r)).toHaveLength(0);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('sin nada que decidir (sesion y empresa en una ruta valida) la pantalla de carga se retira sola', async () => {
    db.auth.getSession.mockResolvedValue({ data: { session } });
    db.on('employees', 'select', { data: employee });
    const r = await mount();
    await settle();
    expect(splash(r)).toHaveLength(0);
  });

  it('REGRESION: hasta que la redireccion se completa sigue la pantalla de carga ("Abriendo tu panel…"), sin enseñar la pantalla equivocada', async () => {
    mockPath = '/auth/login';
    db.auth.getSession.mockResolvedValue({ data: { session } });
    db.on('employees', 'select', { data: employee });
    const r = await mount();
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/home');
    expect(splash(r)).toHaveLength(1);
    expect(label(r)).toBe('Abriendo tu panel…');
  });

  it('sin ficha de empleado: "Preparando tu perfil…" mientras va a completar el perfil', async () => {
    db.auth.getSession.mockResolvedValue({ data: { session } });
    db.on('employees', 'select', { data: null, error: null });
    const r = await mount();
    expect(mockReplace).toHaveBeenCalledWith('/auth/completeProfile');
    expect(label(r)).toBe('Preparando tu perfil…');
  });

  it('sin sesion en ruta protegida: "Un momento…" y sin pasos (se va al login)', async () => {
    const r = await mount();
    expect(mockReplace).toHaveBeenCalledWith('/auth/login');
    expect(label(r)).toBe('Un momento…');
    expect(r.root.findAll((n: any) => n.props.testID === 'boot-steps')).toHaveLength(0);
  });

  it('REGRESION: un fallo de red al cargar la empresa NO manda a "completar perfil" (antes se confundia con "sin ficha")', async () => {
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    db.auth.getSession.mockResolvedValue({ data: { session } });
    db.on('employees', 'select', { error: { message: 'network down' } });
    const r = await mount();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(splash(r)).toHaveLength(1);
    expect(label(r)).toBe('No hemos podido cargar tu empresa');
    expect(rendered(r)).toContain('Reintentar');
    err.mockRestore();
  });

  it('una excepcion al consultar la empresa tambien se trata como fallo, no como "sin ficha"', async () => {
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    db.auth.getSession.mockResolvedValue({ data: { session } });
    db.on('employees', 'select', () => { throw new Error('boom'); });
    const r = await mount();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(label(r)).toBe('No hemos podido cargar tu empresa');
    err.mockRestore();
  });

  it('Reintentar vuelve a consultar la empresa y, si ya responde, entra sin pasar por completar perfil', async () => {
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    db.auth.getSession.mockResolvedValue({ data: { session } });
    let fail = true;
    db.on('employees', 'select', () => (fail ? { error: { message: 'network down' } } : { data: employee }));
    const r = await mount();
    expect(label(r)).toBe('No hemos podido cargar tu empresa');
    fail = false;
    await press(r, 'boot-retry');
    await settle();
    expect(rendered(r)).toContain('Ana');
    expect(splash(r)).toHaveLength(0);
    expect(mockReplace).not.toHaveBeenCalled();
    expect(db.calls.filter((c) => c.table === 'employees').length).toBeGreaterThanOrEqual(2);
    err.mockRestore();
  });

  it('en el error se puede cerrar sesion', async () => {
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    db.auth.getSession.mockResolvedValue({ data: { session } });
    db.on('employees', 'select', { error: { message: 'network down' } });
    const r = await mount();
    await press(r, 'boot-signout');
    expect(db.auth.signOut).toHaveBeenCalledTimes(1);
    err.mockRestore();
  });

  it('si la carga se alarga mas de 12 s se explica y se ofrecen salidas', async () => {
    // Se captura el temporizador de 12 s en vez de usar relojes falsos (que no se llevan bien con act asincrono)
    const real = global.setTimeout;
    let fire: (() => void) | null = null;
    const spy = jest.spyOn(global, 'setTimeout').mockImplementation(((fn: any, ms?: number, ...rest: any[]) => {
      if (ms === 12000) { fire = fn; return 0 as any; }
      return real(fn, ms, ...rest);
    }) as any);
    try {
      db.auth.getSession.mockReturnValue(new Promise(() => {}) as any);
      const r = await mount();
      expect(fire).not.toBeNull();
      expect(rendered(r)).not.toContain('tardando');
      await act(async () => { fire!(); });
      expect(rendered(r)).toContain('tardando más de lo normal');
      expect(rendered(r)).toContain('Reintentar');
    } finally {
      spy.mockRestore();
    }
  });

  it('login posterior: la pantalla de carga vuelve a salir ("Cargando tu empresa…") y se retira al entrar', async () => {
    mockPath = '/auth/login';
    let release: (v: any) => void = () => {};
    db.on('employees', 'select', () => new Promise((res) => { release = res; }));
    const r = await mount();
    await settle();
    await act(async () => { authCallback?.('SIGNED_IN', session); });
    await flush();
    expect(splash(r)).toHaveLength(1);
    expect(label(r)).toBe('Cargando tu empresa…');
    await act(async () => { release({ data: employee }); });
    await flush();
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/home');
  });
});
