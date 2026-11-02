/**
 * Current PNG artwork URLs for the 44-card deck.
 *
 * Vite resolves `import.meta.glob` to asset URLs, so the 1024×1536 PNGs stay
 * separate files: only the artwork each screen displays is requested by the
 * browser. The archived JPEG set is never referenced (tests/assets.test.ts
 * guards this).
 */
import { CANONICAL_DECK, type CardId } from '../engine';

const modules = import.meta.glob('../../assets/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Readonly<Record<string, string>>;

/** Artwork intrinsic size (2:3 aspect ratio), used to reserve layout space. */
export const CARD_ART_WIDTH = 1024;
export const CARD_ART_HEIGHT = 1536;

function artworkKey(card: CardId): string {
  return `../../assets/${card}.png`;
}

export const ARTWORK: Readonly<Record<CardId, string>> = (() => {
  const map: Partial<Record<CardId, string>> = {};
  for (const card of CANONICAL_DECK) {
    const url = modules[artworkKey(card)];
    if (url === undefined) {
      throw new Error(`Missing card artwork for "${card}" (${artworkKey(card)}).`);
    }
    map[card] = url;
  }
  return map as Readonly<Record<CardId, string>>;
})();

export function artworkFor(card: CardId): string {
  return ARTWORK[card];
}

/** Warm the browser cache for the next room without blocking the current one. */
export function preloadArtwork(cards: readonly CardId[]): void {
  if (typeof Image === 'undefined') return;
  for (const card of cards) {
    const image = new Image();
    image.decoding = 'async';
    image.src = artworkFor(card);
  }
}
