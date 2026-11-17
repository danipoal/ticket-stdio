export const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Nombre seguro para una clave de Supabase Storage: sin acentos, espacios ni
 * caracteres raros (que hacen fallar la subida con "Invalid key"), sin
 * separadores de ruta y con longitud acotada. Conserva la extension.
 */
export function safeFileName(name: string | null | undefined, fallback = 'foto.jpg'): string {
  const raw = (name ?? '').trim();
  if (!raw) return fallback;
  const base = raw.split(/[\\/]/).pop() ?? raw;
  const dot = base.lastIndexOf('.');
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot + 1) : '';
  const clean = (s: string) =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
  const cleanStem = clean(stem).slice(0, 60);
  const cleanExt = clean(ext).slice(0, 8).toLowerCase();
  if (!cleanStem) return fallback;
  return cleanExt ? `${cleanStem}.${cleanExt}` : cleanStem;
}

export type PhotoCheck = { ok: true } | { ok: false; message: string };

export function checkPhoto(file: { size?: number; type?: string } | null | undefined): PhotoCheck {
  if (!file) return { ok: true };
  if (file.type && !file.type.startsWith('image/')) {
    return { ok: false, message: 'El archivo debe ser una imagen' };
  }
  if (typeof file.size === 'number' && file.size > MAX_PHOTO_BYTES) {
    return { ok: false, message: 'La imagen supera los 10 MB' };
  }
  return { ok: true };
}
