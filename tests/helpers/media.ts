import { afterEach } from 'vitest';

/**
 * Test-only `matchMedia` control. The app reads two queries: the compact
 * breakpoint and the reduced-motion preference. Every test starts from the
 * desktop/no-reduced-motion default.
 */
export interface MediaOptions {
  compact?: boolean;
  reducedMotion?: boolean;
}

function createMediaQueryList(query: string, options: MediaOptions): MediaQueryList {
  const isCompactQuery = query.includes('max-width');
  const isReducedMotionQuery = query.includes('prefers-reduced-motion');
  const matches = isReducedMotionQuery
    ? options.reducedMotion === true
    : isCompactQuery
      ? options.compact === true
      : false;

  return {
    matches,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
  } as unknown as MediaQueryList;
}

export function installMatchMedia(options: MediaOptions = {}): void {
  window.matchMedia = ((query: string) =>
    createMediaQueryList(query, options)) as typeof window.matchMedia;
}

afterEach(() => {
  installMatchMedia();
});
