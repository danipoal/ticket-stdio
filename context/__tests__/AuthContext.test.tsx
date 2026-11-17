import * as React from 'react';
import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';
import { db } from '../../test-utils/supabaseMock';

jest.mock('@/utils/supabase', () => ({ supabase: require('../../test-utils/supabaseMock').db.client }));
jest.mock('@/components/ui/spinner/index', () => ({ Spinner: () => require('react').createElement('Spinner') }));

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
