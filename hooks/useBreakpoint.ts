import { useWindowDimensions } from 'react-native';

export const DESKTOP_MIN_WIDTH = 1024;
export const TABLET_MIN_WIDTH = 720;

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

export function breakpointFor(width: number): Breakpoint {
  if (width >= DESKTOP_MIN_WIDTH) return 'desktop';
  if (width >= TABLET_MIN_WIDTH) return 'tablet';
  return 'mobile';
}

/** Breakpoint segun el ancho de ventana (se actualiza al redimensionar). */
export function useBreakpoint() {
  const { width } = useWindowDimensions();
  const bp = breakpointFor(width);
  return { width, bp, isDesktop: bp === 'desktop', isWide: bp !== 'mobile' };
}
