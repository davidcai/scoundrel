import { describe, expect, it } from 'vitest';
import { CANONICAL_DECK } from '../../src/engine';
import {
  ARTWORK,
  CARD_ART_HEIGHT,
  CARD_ART_WIDTH,
  artworkFor,
  preloadArtwork,
} from '../../src/ui/artwork';

describe('artwork', () => {
  it('maps every card in the canonical deck', () => {
    expect(Object.keys(ARTWORK)).toEqual([...CANONICAL_DECK]);
  });

  it('uses current PNG artwork only', () => {
    const urls = Object.values(ARTWORK);
    expect(new Set(urls).size).toBe(urls.length);
    for (const url of urls) {
      expect(url).toMatch(/\.png(\?.*)?$/);
      expect(url).not.toMatch(/assets-old/i);
      expect(url).not.toMatch(/\.jpe?g/i);
    }
    for (const card of CANONICAL_DECK) expect(artworkFor(card)).toBe(ARTWORK[card]);
  });

  it('keeps the 2:3 source dimensions', () => {
    expect(CARD_ART_WIDTH).toBe(1024);
    expect(CARD_ART_HEIGHT).toBe(1536);
    expect(CARD_ART_WIDTH / CARD_ART_HEIGHT).toBeCloseTo(2 / 3, 5);
  });

  it('preloads the next room without throwing', () => {
    expect(() => preloadArtwork(CANONICAL_DECK.slice(0, 2))).not.toThrow();
  });
});
