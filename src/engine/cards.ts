export type Suit = "clubs" | "spades" | "diamonds" | "hearts";
export type Role = "monster" | "weapon" | "potion";

export type Card = {
  readonly id: string;
  readonly suit: Suit;
  readonly rank: number;
};

// Private and frozen. Every card id is derived from this table, so a mutation
// would corrupt every id in the game — and ids are React keys and action payloads.
const SUIT_LETTER = {
  clubs: "C",
  diamonds: "D",
  hearts: "H",
  spades: "S",
} as const satisfies Record<Suit, string>;

const ROLE_BY_SUIT = {
  clubs: "monster",
  spades: "monster",
  diamonds: "weapon",
  hearts: "potion",
} as const satisfies Record<Suit, Role>;

export function makeCard(suit: Suit, rank: number): Card {
  return { id: `${SUIT_LETTER[suit]}${rank}`, suit, rank };
}

export function roleOf(card: Card): Role {
  return ROLE_BY_SUIT[card.suit];
}

/** The 44-card Scoundrel dungeon in a fixed, unshuffled order. */
export function buildDungeon(): Card[] {
  const cards: Card[] = [];
  for (const suit of ["clubs", "spades"] as const) {
    for (let rank = 2; rank <= 14; rank += 1) cards.push(makeCard(suit, rank));
  }
  for (const suit of ["diamonds", "hearts"] as const) {
    for (let rank = 2; rank <= 10; rank += 1) cards.push(makeCard(suit, rank));
  }
  return cards;
}
