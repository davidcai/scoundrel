import { MAX_HEALTH, ROOM_SIZE, buildDeck, labelFor, shuffle } from './deck';
import type { Card, CardKind, GameState, LogTone, Suit, Weapon } from './types';

export function cardKind(card: Card): CardKind {
  if (card.suit === 'clubs' || card.suit === 'spades') return 'monster';
  if (card.suit === 'diamonds') return 'weapon';
  return 'potion';
}

export function isRed(suit: Suit): boolean {
  return suit === 'diamonds' || suit === 'hearts';
}

let nextLogId = 1;

function pushLog(s: GameState, text: string, tone: LogTone = 'info'): void {
  s.log = [...s.log, { id: nextLogId++, text, tone }].slice(-50);
}

function copy(state: GameState): GameState {
  return {
    ...state,
    room: [...state.room],
    dungeon: [...state.dungeon],
    log: [...state.log],
    weapon: state.weapon
      ? { card: { ...state.weapon.card }, defeated: [...state.weapon.defeated] }
      : null,
  };
}

function drawToRoom(s: GameState): void {
  while (s.room.length < ROOM_SIZE && s.dungeon.length > 0) {
    s.room.push(s.dungeon.pop() as Card);
  }
}

function startNextRoom(s: GameState): void {
  s.resolved = 0;
  s.potionUsed = false;
  s.ranLastRoom = false;
  s.carried = s.room.length > 0;
  drawToRoom(s);
}

function win(s: GameState): void {
  s.phase = 'won';
  s.score = s.health;
  pushLog(s, 'The dungeon is cleared. You escaped!', 'good');
}

function lose(s: GameState): void {
  s.phase = 'lost';
  const monsters = s.dungeon.filter((c) => cardKind(c) === 'monster');
  s.score = -monsters.reduce((sum, m) => sum + m.value, 0);
  pushLog(
    s,
    `Defeated! ${monsters.length} monster${monsters.length === 1 ? '' : 's'} remain in the dungeon.`,
    'bad',
  );
}

function afterResolve(s: GameState): void {
  const roomStartSize = s.room.length + s.resolved;
  const mustResolve = Math.min(3, roomStartSize);
  if (s.resolved >= mustResolve) {
    startNextRoom(s);
    if (s.room.length === 0) win(s);
  }
}

export function canUseWeapon(weapon: Weapon, monster: Card): boolean {
  const last = weapon.defeated[weapon.defeated.length - 1];
  return last === undefined || monster.value < last.value;
}

export function startGame(deck?: Card[], options?: { shuffle?: boolean }): GameState {
  const cards = deck ?? buildDeck();
  const s: GameState = {
    phase: 'playing',
    dungeon: options?.shuffle === false ? [...cards] : shuffle(cards),
    room: [],
    health: MAX_HEALTH,
    weapon: null,
    potionUsed: false,
    resolved: 0,
    carried: false,
    ranLastRoom: false,
    log: [],
    score: null,
  };
  startNextRoom(s);
  pushLog(s, 'You enter the dungeon. Health 20.', 'info');
  return s;
}

export function fightMonster(state: GameState, cardId: string, useWeapon: boolean): GameState {
  const s = copy(state);
  if (s.phase !== 'playing') return s;
  const idx = s.room.findIndex((c) => c.id === cardId);
  const card = s.room[idx];
  if (!card || cardKind(card) !== 'monster') return state;

  let damage: number;
  if (useWeapon && s.weapon && canUseWeapon(s.weapon, card)) {
    s.weapon = {
      card: s.weapon.card,
      defeated: [...s.weapon.defeated, card],
    };
    damage = Math.max(0, card.value - s.weapon.card.value);
    if (damage > 0) {
      pushLog(s, `${labelFor(card.value)} hits you for ${damage}.`, 'damage');
    } else {
      pushLog(s, `Your ${labelFor(s.weapon.card.value)} cuts through ${labelFor(card.value)} — no damage.`, 'good');
    }
  } else {
    damage = card.value;
    pushLog(s, `Barehanded — ${labelFor(card.value)} hits you for ${damage}.`, 'damage');
  }

  s.health = Math.max(0, s.health - damage);
  s.room.splice(idx, 1);
  s.resolved += 1;

  if (s.health <= 0) {
    lose(s);
  } else {
    afterResolve(s);
  }
  return s;
}

export function equipWeapon(state: GameState, cardId: string): GameState {
  const s = copy(state);
  if (s.phase !== 'playing') return s;
  const idx = s.room.findIndex((c) => c.id === cardId);
  const card = s.room[idx];
  if (!card || cardKind(card) !== 'weapon') return state;

  if (s.weapon) {
    pushLog(s, `You discard your ${labelFor(s.weapon.card.value)} and equip ${labelFor(card.value)}.`, 'good');
  } else {
    pushLog(s, `You equip ${labelFor(card.value)}.`, 'good');
  }
  s.weapon = { card, defeated: [] };
  s.room.splice(idx, 1);
  s.resolved += 1;
  afterResolve(s);
  return s;
}

export function drinkPotion(state: GameState, cardId: string): GameState {
  const s = copy(state);
  if (s.phase !== 'playing') return s;
  const idx = s.room.findIndex((c) => c.id === cardId);
  const card = s.room[idx];
  if (!card || cardKind(card) !== 'potion') return state;

  if (s.potionUsed) {
    pushLog(s, `The ${labelFor(card.value)} potion evaporates — one potion per room.`, 'info');
  } else {
    s.potionUsed = true;
    const healed = Math.min(card.value, MAX_HEALTH - s.health);
    s.health += healed;
    if (healed > 0) {
      pushLog(s, `You drink the potion and recover ${healed} health.`, 'heal');
    } else {
      pushLog(s, 'You are already at full health.', 'heal');
    }
  }
  s.room.splice(idx, 1);
  s.resolved += 1;
  afterResolve(s);
  return s;
}

export function runAway(state: GameState): GameState {
  const s = copy(state);
  if (s.phase !== 'playing') return s;
  if (s.ranLastRoom) return state;
  if (s.dungeon.length === 0) return state;

  s.dungeon.unshift(...s.room);
  s.room = [];
  startNextRoom(s);
  s.ranLastRoom = true;
  if (s.room.length === 0) win(s);
  else pushLog(s, 'You flee. The room is buried at the bottom of the dungeon.', 'info');
  return s;
}
