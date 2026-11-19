import { Platform } from 'react-native';
import { authRedirect, linkErrorMessage, parseAuthHash, siteUrl } from '../authLinks';

describe('parseAuthHash', () => {
  it('lee los tokens del fragmento de Supabase', () => {
    expect(parseAuthHash('#access_token=AAA&refresh_token=BBB&expires_in=3600&token_type=bearer&type=recovery')).toEqual({
      access_token: 'AAA', refresh_token: 'BBB', type: 'recovery',
    });
  });
  it('decodifica %XX y + en las descripciones de error', () => {
    const h = parseAuthHash('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired%21');
    expect(h.error).toBe('access_denied');
    expect(h.error_code).toBe('otp_expired');
    expect(h.error_description).toBe('Email link is invalid or has expired!');
  });
  it('ignora claves desconocidas y fragmentos vacios o nulos', () => {
    expect(parseAuthHash('#foo=bar&x')).toEqual({});
    for (const v of ['', '#', null, undefined, '   ']) expect(parseAuthHash(v as any)).toEqual({});
  });
  it('acepta el fragmento sin # inicial y tolera & repetidos', () => {
    expect(parseAuthHash('access_token=A&&refresh_token=B&')).toEqual({ access_token: 'A', refresh_token: 'B' });
  });
});

describe('linkErrorMessage', () => {
  it('sin error -> null', () => {
    expect(linkErrorMessage({})).toBeNull();
    expect(linkErrorMessage({ access_token: 'x' })).toBeNull();
  });
  it('enlace caducado o ya usado', () => {
    expect(linkErrorMessage({ error: 'access_denied', error_code: 'otp_expired' })).toMatch(/caducado|usado/);
    expect(linkErrorMessage({ error: 'x', error_description: 'Email link is invalid or has expired' })).toMatch(/caducado/);
  });
  it('otro error -> mensaje generico', () => {
    expect(linkErrorMessage({ error: 'server_error' })).toMatch(/No se pudo validar/);
  });
});

describe('siteUrl / authRedirect', () => {
  const original = Platform.OS;
  afterEach(() => {
    Platform.OS = original;
    delete (global as any).window;
  });
  it('web: usa el origen actual (funciona tambien en desarrollo) sin barra final', () => {
    Platform.OS = 'web';
    (global as any).window = { location: { origin: 'http://localhost:8081/' } };
    expect(siteUrl()).toBe('http://localhost:8081');
    expect(authRedirect('/auth/reset')).toBe('http://localhost:8081/auth/reset');
  });
  it('movil: dominio de produccion por defecto (EXPO_PUBLIC_SITE_URL se incrusta al compilar)', () => {
    Platform.OS = 'android';
    expect(siteUrl()).toBe('https://ticket.danipoal.com');
  });
  it('anade la barra inicial si falta', () => {
    Platform.OS = 'android';
    expect(authRedirect('auth/confirmed')).toBe('https://ticket.danipoal.com/auth/confirmed');
  });
});
