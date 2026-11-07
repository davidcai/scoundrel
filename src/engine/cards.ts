import type { Card, CardId } from './types';

const numbers = ['2', '3', '4', '5', '6', '7', '8', '9', '10'] as const;
const blackRanks = [...numbers, 'j', 'q', 'k', 'a'] as const;
const cards: Card[] = [];
for (const suit of ['club', 'spade'] as const) {
  blackRanks.forEach((rank, index) =>
    cards.push(Object.freeze({ id: `${suit}-${rank}`, kind: 'monster', value: index + 2 })),
  );
}
for (const suit of ['diamond', 'heart'] as const) {
  numbers.forEach((rank, index) =>
    cards.push(
      Object.freeze({
        id: `${suit}-${rank}`,
        kind: suit === 'diamond' ? 'weapon' : 'potion',
        value: index + 2,
      }),
    ),
  );
}
const catalog = new Map<CardId, Card>(cards.map((card) => [card.id, card]));
export const CARD_IDS: readonly CardId[] = Object.freeze(cards.map((card) => card.id));
export function isCardId(value: unknown): value is CardId {
  return typeof value === 'string' && catalog.has(value as CardId);
}
export function getCard(id: CardId): Card {
  const card = catalog.get(id);
  if (!card) throw new RangeError('Unknown card');
  return card;
}
export function lossScore(dungeon: readonly CardId[]): number {
  return dungeon.reduce(
    (score, id) => (getCard(id).kind === 'monster' ? score - getCard(id).value : score),
    0,
  );
}
