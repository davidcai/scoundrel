import type { CardId } from '../engine';
const images = import.meta.glob<string>('../../.generated/card-artwork/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
});
export function cardImage(id: CardId): string {
  return images[`../../.generated/card-artwork/${id}.webp`];
}
export const titleArtwork = {
  weapon: cardImage('diamond-5'),
  potion: cardImage('heart-6'),
  monster: cardImage('spade-k'),
};
