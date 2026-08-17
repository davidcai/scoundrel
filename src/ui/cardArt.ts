import type { CardId } from '../engine';

/**
 * Lazily maps card ids to the provided raster artwork in the repo-root
 * assets/ directory (assets/<suit>-<value>.jpg). Vite hashes and serves
 * these as static assets.
 */
const modules = import.meta.glob('../../assets/*.jpg', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

export function cardArtUrl(cardId: CardId): string {
  return modules['../../assets/' + cardId + '.jpg'] ?? '';
}

export function hasCardArt(cardId: CardId): boolean {
  return Boolean(modules['../../assets/' + cardId + '.jpg']);
}
