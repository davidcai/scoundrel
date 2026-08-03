// Scoundrel game engine — pure state and rules, no DOM.
// docs/rules.md is the source of truth for all gameplay behavior.

export type Suit = 'clubs' | 'spades' | 'diamonds' | 'hearts';

export interface Card {
  suit: Suit;
  /** 2–10 face value; 11 = Jack, 12 = Queen, 13 = King, 14 = Ace. */
  rank: number;
}

export type CardKind = 'monster' | 'weapon' | 'potion';

export interface EquippedWeapon {
  card: Card;
  /** Monsters slain by this weapon, oldest first. The most recent kill caps what it may strike next. */
  kills: Card[];
}

export type GameStatus = 'playing' | 'won' | 'lost';

export interface GameState {
  /** Draw pile (the Dungeon) — index 0 is the top. */
  deck: Card[];
  room: Card[];
  discard: Card[];
  health: number;
  weapon: EquippedWeapon | null;
  potionUsedThisRoom: boolean;
  resolvedThisRoom: number;
  ranFromLastRoom: boolean;
  status: GameStatus;
  /** Remaining health on a win; 0 minus the deck's remaining monster values on a loss. */
  score: number;
}

export const MAX_HEALTH = 20;
export const ROOM_SIZE = 4;

const SUIT_SYMBOLS: Record<Suit, string> = {
  clubs: '♣',
  spades: '♠',
  diamonds: '♦',
  hearts: '♥',
};

const FACE_LABELS: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

export function suitSymbol(suit: Suit): string {
  return SUIT_SYMBOLS[suit];
}

export function rankLabel(rank: number): string {
  return FACE_LABELS[rank] ?? String(rank);
}

export function cardLabel(card: Card): string {
  return `${rankLabel(card.rank)}${SUIT_SYMBOLS[card.suit]}`;
}

export function cardKind(card: Card): CardKind {
  if (card.suit === 'hearts') return 'potion';
  if (card.suit === 'diamonds') return 'weapon';
  return 'monster';
}

/** 44 cards: full clubs and spades, diamonds and hearts 2–10 (red faces and red aces removed). */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of ['clubs', 'spades'] as const) {
    for (let rank = 2; rank <= 14; rank++) deck.push({ suit, rank });
  }
  for (const suit of ['diamonds', 'hearts'] as const) {
    for (let rank = 2; rank <= 10; rank++) deck.push({ suit, rank });
  }
  return deck;
}

/** mulberry32 — tiny seedable PRNG so a dungeon can be replayed from its seed. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

export function newGame(seed: number): GameState {
  const state: GameState = {
    deck: shuffle(createDeck(), mulberry32(seed)),
    room: [],
    discard: [],
    health: MAX_HEALTH,
    weapon: null,
    potionUsedThisRoom: false,
    resolvedThisRoom: 0,
    ranFromLastRoom: false,
    status: 'playing',
    score: 0,
  };
  dealRoom(state);
  return state;
}

/** Damage taken when striking a monster with a weapon: the difference, never negative. */
export function strikeDamage(weaponCard: Card, monster: Card): number {
  return Math.max(0, monster.rank - weaponCard.rank);
}

/** The rank of the weapon's most recent kill, or null for a fresh weapon (no cap). */
export function weaponKillCap(weapon: EquippedWeapon): number | null {
  const lastKill = weapon.kills[weapon.kills.length - 1];
  return lastKill ? lastKill.rank : null;
}

/** A weapon may only strike monsters strictly weaker than its most recent kill. */
export function canUseWeaponOn(state: GameState, monster: Card): boolean {
  if (!state.weapon) return false;
  const cap = weaponKillCap(state.weapon);
  return cap === null || monster.rank < cap;
}

/** Running is allowed once per room, before any card is resolved, never twice in a row. */
export function canRun(state: GameState): boolean {
  return (
    state.status === 'playing' &&
    !state.ranFromLastRoom &&
    state.resolvedThisRoom === 0 &&
    state.room.length > 0
  );
}

function dealRoom(state: GameState): void {
  while (state.room.length < ROOM_SIZE && state.deck.length > 0) {
    state.room.push(state.deck.shift()!);
  }
  state.potionUsedThisRoom = false;
  state.resolvedThisRoom = 0;
}

function takeFromRoom(state: GameState, index: number, expected: CardKind): Card {
  if (state.status !== 'playing') throw new Error('The game is over.');
  const card = state.room[index];
  if (!card) throw new Error(`No card at room index ${index}.`);
  if (cardKind(card) !== expected) {
    throw new Error(`Expected a ${expected} at room index ${index}, found ${cardLabel(card)}.`);
  }
  state.room.splice(index, 1);
  state.resolvedThisRoom += 1;
  return card;
}

function applyMonsterDamage(state: GameState, damage: number, events: string[]): void {
  if (damage <= 0) return;
  state.health -= damage;
  if (state.health <= 0) {
    state.health = 0;
    state.status = 'lost';
    // Per the rules, the negative score counts only unplayed monsters left in the dungeon deck.
    const remaining = state.deck
      .filter((card) => cardKind(card) === 'monster')
      .reduce((sum, card) => sum + card.rank, 0);
    state.score = -remaining;
    events.push(`You have been slain. Final score: ${state.score}.`);
  }
}

/** Win check and automatic carry-over deal once 3 of 4 cards are resolved. */
function finishAction(state: GameState, events: string[]): string[] {
  if (state.status !== 'playing') return events;
  if (state.room.length === 0 && state.deck.length === 0) {
    state.status = 'won';
    state.score = state.health;
    events.push(`Dungeon cleared! Final score: ${state.score}.`);
  } else if (state.room.length === 1 && state.deck.length > 0) {
    state.ranFromLastRoom = false;
    dealRoom(state);
    events.push('You advance to the next room.');
  }
  return events;
}

export function fightMonster(state: GameState, index: number, useWeapon: boolean): string[] {
  const target = state.room[index];
  if (useWeapon && (!target || !canUseWeaponOn(state, target))) {
    throw new Error('Your weapon cannot strike that monster.');
  }
  const monster = takeFromRoom(state, index, 'monster');
  const events: string[] = [];
  if (useWeapon) {
    const weapon = state.weapon!;
    const damage = strikeDamage(weapon.card, monster);
    weapon.kills.push(monster);
    events.push(
      damage > 0
        ? `Slew ${cardLabel(monster)} with ${cardLabel(weapon.card)} — took ${damage} damage.`
        : `Slew ${cardLabel(monster)} with ${cardLabel(weapon.card)} — unscathed.`,
    );
    applyMonsterDamage(state, damage, events);
  } else {
    state.discard.push(monster);
    events.push(`Fought ${cardLabel(monster)} barehanded — took ${monster.rank} damage.`);
    applyMonsterDamage(state, monster.rank, events);
  }
  return finishAction(state, events);
}

export function equipWeapon(state: GameState, index: number): string[] {
  const card = takeFromRoom(state, index, 'weapon');
  const events: string[] = [];
  if (state.weapon) {
    state.discard.push(state.weapon.card, ...state.weapon.kills);
    events.push(`Discarded ${cardLabel(state.weapon.card)}.`);
  }
  state.weapon = { card, kills: [] };
  events.push(`Equipped ${cardLabel(card)}.`);
  return finishAction(state, events);
}

export function drinkPotion(state: GameState, index: number): string[] {
  const card = takeFromRoom(state, index, 'potion');
  const events: string[] = [];
  if (state.potionUsedThisRoom) {
    events.push(`Already used a potion this room — ${cardLabel(card)} is discarded.`);
  } else {
    const healed = Math.min(MAX_HEALTH - state.health, card.rank);
    state.health += healed;
    state.potionUsedThisRoom = true;
    events.push(`Drank ${cardLabel(card)} — restored ${healed} health.`);
  }
  state.discard.push(card);
  return finishAction(state, events);
}

export function runAway(state: GameState): string[] {
  if (!canRun(state)) throw new Error('You cannot run from this room.');
  state.deck.push(...state.room);
  state.room = [];
  state.ranFromLastRoom = true;
  dealRoom(state);
  return ['You flee — the room is buried at the bottom of the dungeon.'];
}
