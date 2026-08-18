/**
 * Card artwork manifest: build-time `import.meta.glob` over the 44 JPGs,
 * keyed by filename stem — which IS the CardId (Q56). A unit test asserts the
 * manifest and the engine's CARD_IDS table contain exactly the same set.
 */
import type { CardId } from '../../engine';

const modules = import.meta.glob<string>('../../assets/cards/*.jpg', {
  eager: true,
  import: 'default',
});

function stemOf(path: string): string {
  const base = path.slice(path.lastIndexOf('/') + 1);
  return base.slice(0, base.lastIndexOf('.'));
}

/** CardId (filename stem) → resolved asset URL. */
export const CARD_ART: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(Object.entries(modules).map(([path, url]) => [stemOf(path), url])),
);

export function cardArtUrl(id: CardId): string | undefined {
  return CARD_ART[id];
}
