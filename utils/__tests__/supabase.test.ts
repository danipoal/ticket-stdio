import { db } from '../../test-utils/supabaseMock';

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => require('../../test-utils/supabaseMock').db.client,
}));

import { login, requestPasswordReset, sessionFromLinkTokens, signin, updatePassword } from '../supabase';

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

describe('registro con confirmacion de correo', () => {
  beforeEach(() => jest.clearAllMocks());
  it('signUp pide volver a /auth/confirmed tras confirmar el correo', async () => {
    db.auth.signUp.mockResolvedValue({ data: { user: { identities: [{}] }, session: null }, error: null });
    await signin('a@b.co', 'secreto');
    const arg = (db.auth.signUp.mock.calls[0] as any)[0];
    expect(arg.options.emailRedirectTo).toMatch(/\/auth\/confirmed$/);
    expect(arg.email).toBe('a@b.co');
  });
});

describe('recuperar contraseña', () => {
  beforeEach(() => jest.clearAllMocks());
  (db.auth as any).resetPasswordForEmail = jest.fn();
  (db.auth as any).setSession = jest.fn();
  (db.auth as any).updateUser = jest.fn();

  it('envia el correo recortado y redirige a /auth/reset', async () => {
    (db.auth as any).resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    expect(await requestPasswordReset('  a@b.co ')).toEqual({ ok: true, needsConfirmation: false });
    const [email, opts] = (db.auth as any).resetPasswordForEmail.mock.calls[0];
    expect(email).toBe('a@b.co');
    expect(opts.redirectTo).toMatch(/\/auth\/reset$/);
  });
  it('error de limite de envios -> mensaje claro', async () => {
    (db.auth as any).resetPasswordForEmail.mockResolvedValue({ data: null, error: { message: 'Email rate limit exceeded' } });
    expect(await requestPasswordReset('a@b.co')).toEqual({ ok: false, message: 'Demasiados intentos. Espera un momento y vuelve a probar' });
  });
  it('error de red (rechaza la promesa) no revienta', async () => {
    (db.auth as any).resetPasswordForEmail.mockRejectedValue(new Error('Failed to fetch'));
    expect((await requestPasswordReset('a@b.co')).ok).toBe(false);
  });
  it('sessionFromLinkTokens abre la sesion del enlace', async () => {
    (db.auth as any).setSession.mockResolvedValue({ data: {}, error: null });
    expect((await sessionFromLinkTokens('AT', 'RT')).ok).toBe(true);
    expect((db.auth as any).setSession).toHaveBeenCalledWith({ access_token: 'AT', refresh_token: 'RT' });
    (db.auth as any).setSession.mockResolvedValue({ data: null, error: { message: 'Auth session missing!' } });
    expect((await sessionFromLinkTokens('AT', 'RT')).ok).toBe(false);
  });
  it('updatePassword', async () => {
    (db.auth as any).updateUser.mockResolvedValue({ data: {}, error: null });
    expect((await updatePassword('nueva-clave')).ok).toBe(true);
    expect((db.auth as any).updateUser).toHaveBeenCalledWith({ password: 'nueva-clave' });
    (db.auth as any).updateUser.mockResolvedValue({ data: null, error: { message: 'New password should be different from the old password.' } });
    expect(await updatePassword('igual')).toEqual({ ok: false, message: 'La nueva contraseña debe ser distinta de la anterior' });
  });
});
