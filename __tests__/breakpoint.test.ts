import { breakpointFor, DESKTOP_MIN_WIDTH, TABLET_MIN_WIDTH, splitPanes } from '@/hooks/useBreakpoint';

describe('splitPanes (reparto lista + detalle en escritorio)', () => {
  it('ventana justa de escritorio: lista estrecha y detalle en tarjetas', () => {
    const p = splitPanes(DESKTOP_MIN_WIDTH);
    expect(p.listWidth).toBe(300);
    expect(p.detailWide).toBe(false);
  });
  it('pantalla normal: lista proporcional y tabla ancha', () => {
    const p = splitPanes(1440);
    expect(p.listWidth).toBeGreaterThanOrEqual(300);
    expect(p.listWidth).toBeLessThanOrEqual(400);
    expect(p.detailWide).toBe(true);
  });
  it('pantalla enorme: la lista no pasa de 400 px', () => {
    expect(splitPanes(3000).listWidth).toBe(400);
  });
  it('el detalle siempre tiene mas sitio que antes con la lista fija de 400 px', () => {
    for (const w of [1024, 1100, 1280, 1366]) {
      expect(splitPanes(w).listWidth).toBeLessThanOrEqual(400);
      expect(splitPanes(w).detailWidth).toBeGreaterThanOrEqual(w - 248 - 64 - 400 - 20);
    }
  });
});

describe('breakpointFor', () => {
  it.each([
    [320, 'mobile'], [390, 'mobile'], [TABLET_MIN_WIDTH - 1, 'mobile'], [TABLET_MIN_WIDTH, 'tablet'],
    [900, 'tablet'], [DESKTOP_MIN_WIDTH - 1, 'tablet'], [DESKTOP_MIN_WIDTH, 'desktop'], [1440, 'desktop'], [2560, 'desktop'],
  ])('%ipx -> %s', (w, bp) => {
    expect(breakpointFor(w)).toBe(bp);
  });
});
