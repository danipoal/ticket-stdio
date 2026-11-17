import { checkPhoto, MAX_PHOTO_BYTES, safeFileName } from '../files';

describe('safeFileName', () => {
  it.each([
    ['foto.jpg', 'foto.jpg'],
    ['Mi Ticket Comida.PNG', 'Mi_Ticket_Comida.png'],
    ['recibo café ñandú.jpeg', 'recibo_cafe_nandu.jpeg'],
    ['a/b\\c/../etc.png', 'etc.png'],
    ['  espacios  .webp ', 'espacios.webp'],
    ['IMG#1?(copia).jpg', 'IMG_1_copia.jpg'],
    ['sinextension', 'sinextension'],
  ])('%s -> %s', (input, expected) => {
    expect(safeFileName(input)).toBe(expected);
  });

  it('vacio, null o solo simbolos -> fallback', () => {
    expect(safeFileName('')).toBe('foto.jpg');
    expect(safeFileName(null)).toBe('foto.jpg');
    expect(safeFileName(undefined)).toBe('foto.jpg');
    expect(safeFileName('???.jpg')).toBe('foto.jpg');
    expect(safeFileName('x', 'otra.png')).toBe('x');
    expect(safeFileName('', 'otra.png')).toBe('otra.png');
  });

  it('acota la longitud', () => {
    const out = safeFileName('a'.repeat(300) + '.jpg');
    expect(out.length).toBeLessThanOrEqual(60 + 1 + 8);
    expect(out.endsWith('.jpg')).toBe(true);
  });

  it('nunca contiene separadores de ruta ni ..', () => {
    for (const n of ['../../secreto.png', '..\\..\\x.png', 'a/../b.png']) {
      const out = safeFileName(n);
      expect(out).not.toMatch(/[\\/]/);
      expect(out).not.toContain('..');
    }
  });
});

describe('checkPhoto', () => {
  it('sin fichero es valido (la foto es opcional)', () => {
    expect(checkPhoto(null)).toEqual({ ok: true });
    expect(checkPhoto(undefined)).toEqual({ ok: true });
  });
  it('acepta imagenes pequenas', () => {
    expect(checkPhoto({ type: 'image/jpeg', size: 1024 })).toEqual({ ok: true });
    expect(checkPhoto({ size: MAX_PHOTO_BYTES })).toEqual({ ok: true });
  });
  it('rechaza lo que no es imagen', () => {
    expect(checkPhoto({ type: 'application/pdf', size: 10 }).ok).toBe(false);
  });
  it('rechaza mas de 10 MB', () => {
    expect(checkPhoto({ type: 'image/png', size: MAX_PHOTO_BYTES + 1 }).ok).toBe(false);
  });
});
