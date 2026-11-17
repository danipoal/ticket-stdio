import { db } from '../../test-utils/supabaseMock';

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => require('../../test-utils/supabaseMock').db.client,
}));

import { login, signin } from '../supabase';

describe('login', () => {
  beforeEach(() => jest.clearAllMocks());

  it('credenciales correctas -> ok', async () => {
    db.auth.signInWithPassword.mockResolvedValue({ data: { session: {} }, error: null });
    expect(await login(' a@b.co ', 'secreto')).toEqual({ ok: true, needsConfirmation: false });
    expect(db.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.co', password: 'secreto' });
  });

  it('credenciales incorrectas -> mensaje en castellano', async () => {
    db.auth.signInWithPassword.mockResolvedValue({ data: {}, error: { message: 'Invalid login credentials' } });
    expect(await login('a@b.co', 'x')).toEqual({ ok: false, message: 'Email o contraseña incorrectos' });
  });

  it('error de red (la promesa rechaza) no revienta', async () => {
    db.auth.signInWithPassword.mockRejectedValue(new Error('Failed to fetch'));
    const r = await login('a@b.co', 'x');
    expect(r.ok).toBe(false);
  });

  it('no escribe tokens ni la sesion en la consola', async () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    db.auth.signInWithPassword.mockResolvedValue({
      data: { session: { access_token: 'TOKEN-SECRETO' } }, error: null,
    });
    await login('a@b.co', 'x');
    expect(JSON.stringify(spy.mock.calls)).not.toContain('TOKEN-SECRETO');
    spy.mockRestore();
  });
});

describe('signin', () => {
  beforeEach(() => jest.clearAllMocks());

  it('registro con sesion inmediata', async () => {
    db.auth.signUp.mockResolvedValue({ data: { user: { identities: [{}] }, session: {} }, error: null });
    expect(await signin('a@b.co', 'secreto')).toEqual({ ok: true, needsConfirmation: false });
  });

  it('registro que requiere confirmar email (sin sesion)', async () => {
    db.auth.signUp.mockResolvedValue({ data: { user: { identities: [{}] }, session: null }, error: null });
    expect(await signin('a@b.co', 'secreto')).toEqual({ ok: true, needsConfirmation: true });
  });

  it('email ya registrado: Supabase no da error, devuelve identities vacias', async () => {
    db.auth.signUp.mockResolvedValue({ data: { user: { identities: [] }, session: null }, error: null });
    expect(await signin('a@b.co', 'secreto')).toEqual({ ok: false, message: 'Este email ya está registrado' });
  });

  it('password corta -> mensaje', async () => {
    db.auth.signUp.mockResolvedValue({ data: {}, error: { message: 'Password should be at least 6 characters.' } });
    const r = await signin('a@b.co', '1');
    expect(r).toEqual({ ok: false, message: 'La contraseña es demasiado corta' });
  });
});
