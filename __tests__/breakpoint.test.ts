import { breakpointFor, DESKTOP_MIN_WIDTH, TABLET_MIN_WIDTH } from '@/hooks/useBreakpoint';

describe('breakpointFor', () => {
  it.each([
    [320, 'mobile'], [390, 'mobile'], [TABLET_MIN_WIDTH - 1, 'mobile'], [TABLET_MIN_WIDTH, 'tablet'],
    [900, 'tablet'], [DESKTOP_MIN_WIDTH - 1, 'tablet'], [DESKTOP_MIN_WIDTH, 'desktop'], [1440, 'desktop'], [2560, 'desktop'],
  ])('%ipx -> %s', (w, bp) => {
    expect(breakpointFor(w)).toBe(bp);
  });
});
