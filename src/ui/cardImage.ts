import type { CardId } from '../engine';

/**
 * Card artwork is bundled through Vite's asset pipeline (`import.meta.glob`)
 * rather than the public dir: the emitted URLs are hashed and always correct
 * relative to the configured base path, no matter how the app is served.
 * The committed `assets/*.jpg` filenames are the CardIds.
 */
const modules = import.meta.glob('/assets/*.jpg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const urlByCardId: Record<string, string> = {};
for (const [path, url] of Object.entries(modules)) {
  const id = path.slice(path.lastIndexOf('/') + 1).replace(/\.jpg$/, '');
  urlByCardId[id] = url;
}

export function cardImageUrl(cardId: CardId): string {
  return urlByCardId[cardId] ?? '';
}
