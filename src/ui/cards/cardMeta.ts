/**
 * Display-only card metadata, derived from the CardId string format (frozen
 * by the artwork naming convention, Q56). These mirror the engine's pure
 * helpers but are intentionally local: the engine in this lane is a throwing
 * stub, and UI/tests must never depend on engine runtime behavior. Both sides
 * derive from docs/rules.md, so they agree by construction.
 */
import type { CardId, CardKind, Suit, Value } from '../../engine';

const SUITS: readonly Suit[] = ['club', 'spade', 'diamond', 'heart'];

export function parseCardId(id: CardId): { suit: Suit; value: Value } {
  const idx = id.indexOf('-');
  const suit = id.slice(0, idx) as Suit;
  const value = id.slice(idx + 1) as Value;
  return { suit, value };
}

export function suitOfId(id: CardId): Suit {
  return parseCardId(id).suit;
}

/** Rules.md values: J=11, Q=12, K=13, A=14. */
export function numericValueOf(id: CardId): number {
  const { value } = parseCardId(id);
  switch (value) {
    case 'j':
      return 11;
    case 'q':
      return 12;
    case 'k':
      return 13;
    case 'a':
      return 14;
    default:
      return Number.parseInt(value, 10);
  }
}

export function kindOfId(id: CardId): CardKind {
  const { suit } = parseCardId(id);
  if (suit === 'diamond') return 'weapon';
  if (suit === 'heart') return 'potion';
  return 'monster';
}

export const SUIT_GLYPH: Record<Suit, string> = {
  club: '♣',
  spade: '♠',
  diamond: '◆',
  heart: '♥',
};

export const SUIT_NAME: Record<Suit, string> = {
  club: 'Clubs',
  spade: 'Spades',
  diamond: 'Diamonds',
  heart: 'Hearts',
};

/** Short rank text for the badge: "8", "10", "J", "Q", "K", "A". */
export function rankLabel(id: CardId): string {
  const { value } = parseCardId(id);
  return value.length === 1 ? value.toUpperCase() : value;
}

/** "8 of Clubs" */
export function cardDisplayName(id: CardId): string {
  const { suit } = parseCardId(id);
  return `${rankLabel(id)} of ${SUIT_NAME[suit]}`;
}

/** "8 of Clubs, monster, value 8" (Q56 spec §accessibility). */
export function cardAriaLabel(id: CardId): string {
  return `${cardDisplayName(id)}, ${kindOfId(id)}, value ${numericValueOf(id)}`;
}

/** One-line rule hint for the card-type tooltip (Q59). */
export function cardKindHint(id: CardId): string {
  const kind = kindOfId(id);
  const value = numericValueOf(id);
  switch (kind) {
    case 'monster':
      return `Monster — fight barehanded for ${value} damage, or with a weapon to reduce it.`;
    case 'weapon':
      return `Weapon (strength ${value}) — equipping discards your current weapon and everything it has slain.`;
    case 'potion':
      return `Potion — heals ${value} HP (max 20). Only one potion heals per room.`;
  }
}

export function isSuit(value: string): value is Suit {
  return (SUITS as readonly string[]).includes(value);
}
