import type { CardId } from '../engine';
const images = import.meta.glob<string>('../../assets/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});
export function cardImage(id: CardId): string {
  return images[`../../assets/${id}.png`];
}
export const titleArtwork = {
  weapon: cardImage('diamond-5'),
  potion: cardImage('heart-6'),
  monster: cardImage('spade-k'),
};
