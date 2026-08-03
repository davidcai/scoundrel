export type Suit = "clubs" | "spades" | "diamonds" | "hearts";
export type Role = "monster" | "weapon" | "potion";

export type Card = {
  readonly id: string;
  readonly suit: Suit;
  readonly rank: number;
};

export const SUIT_LETTER: Record<Suit, string> = {
  clubs: "C",
  diamonds: "D",
  hearts: "H",
  spades: "S",
};

const ROLE_BY_SUIT: Record<Suit, Role> = {
  clubs: "monster",
  spades: "monster",
  diamonds: "weapon",
  hearts: "potion",
};

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
