import { Platform } from 'react-native';

export const DEFAULT_SITE_URL = 'https://ticket.danipoal.com';

/**
 * URL base a la que Supabase redirige tras pulsar un enlace del correo.
 * En web se usa el origen actual (asi funciona tambien en desarrollo); si no, EXPO_PUBLIC_SITE_URL o el dominio de produccion.
 * Debe estar en la lista de URLs permitidas de Supabase Auth.
 */
export function siteUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '');
  }
  return (process.env.EXPO_PUBLIC_SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, '');
}

export const authRedirect = (path: string) => `${siteUrl()}${path.startsWith('/') ? path : `/${path}`}`;

export type AuthHash = {
  access_token?: string;
  refresh_token?: string;
  type?: string;
  error?: string;
  error_code?: string;
  error_description?: string;
};

/** Lee el fragmento (#a=b&c=d) que anade Supabase al redirigir tras verificar un enlace del correo. */
export function parseAuthHash(hash: string | null | undefined): AuthHash {
  const raw = (hash ?? '').replace(/^#/, '').trim();
  if (!raw) return {};
  const out: Record<string, string> = {};
  for (const part of raw.split('&')) {
    if (!part) continue;
    const i = part.indexOf('=');
    const key = decodeURIComponent(i === -1 ? part : part.slice(0, i));
    const value = i === -1 ? '' : decodeURIComponent(part.slice(i + 1).replace(/\+/g, ' '));
    if (['access_token', 'refresh_token', 'type', 'error', 'error_code', 'error_description'].includes(key)) out[key] = value;
  }
  return out;
}

/** Mensaje claro para un enlace caducado o ya usado. */
export function linkErrorMessage(h: AuthHash): string | null {
  if (!h.error && !h.error_code) return null;
  const code = (h.error_code ?? '').toLowerCase();
  const desc = (h.error_description ?? '').toLowerCase();
  if (code.includes('otp_expired') || desc.includes('expired') || desc.includes('invalid')) {
    return 'El enlace ha caducado o ya se ha usado. Pide uno nuevo.';
  }
  return 'No se pudo validar el enlace. Pide uno nuevo.';
}
