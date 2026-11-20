import { useWindowDimensions } from 'react-native';

export const DESKTOP_MIN_WIDTH = 1024;
export const TABLET_MIN_WIDTH = 720;

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

export function breakpointFor(width: number): Breakpoint {
  if (width >= DESKTOP_MIN_WIDTH) return 'desktop';
  if (width >= TABLET_MIN_WIDTH) return 'tablet';
  return 'mobile';
}

const SIDEBAR_WIDTH = 248;
const PAGE_PADDING = 64; // 32 a cada lado
const PAGE_MAX_WIDTH = 1500;
const PANE_GAP = 20;
const DETAIL_PADDING = 44;
/** Ancho minimo del detalle para pintar las lineas como tabla; por debajo se usan tarjetas. */
export const DETAIL_TABLE_MIN_WIDTH = 600;

/**
 * Reparto de los dos paneles (lista + detalle) en escritorio: la lista ocupa ~1/3 del ancho util
 * (entre 300 y 400 px) y la tabla de lineas solo se usa si el detalle tiene sitio para sus 6 columnas.
 */
export function splitPanes(width: number) {
  const content = Math.min(width - SIDEBAR_WIDTH, PAGE_MAX_WIDTH) - PAGE_PADDING;
  const listWidth = Math.max(300, Math.min(400, Math.round(content * 0.34)));
  const detailWidth = content - listWidth - PANE_GAP;
  return { listWidth, detailWidth, detailWide: detailWidth - DETAIL_PADDING >= DETAIL_TABLE_MIN_WIDTH };
}

/** Breakpoint segun el ancho de ventana (se actualiza al redimensionar). */
export function useBreakpoint() {
  const { width } = useWindowDimensions();
  const bp = breakpointFor(width);
  return { width, bp, isDesktop: bp === 'desktop', isWide: bp !== 'mobile', ...splitPanes(width) };
}
