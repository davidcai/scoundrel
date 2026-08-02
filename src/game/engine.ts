import type { Action, Card, EquippedWeapon, GameState } from './types';
import { HEALTH_MAX, RESOLVES_PER_ROOM, RANK_LABEL, SUIT_SYMBOL } from './constants';
import { buildDungeon, shuffle } from './deck';
import { mulberry32, randomSeed } from './rng';
import {
  canRun,
  canUseWeapon,
  cardKind,
  combatDamage,
  healAmount,
  monsterValuesSum,
} from './rules';

function cardName(card: Card): string {
  return `${RANK_LABEL[card.rank]}${SUIT_SYMBOL[card.suit]}`;
}

function drawFrom(dungeon: Card[], n: number): { drawn: Card[]; remaining: Card[] } {
  const drawn = dungeon.slice(0, n);
  const remaining = dungeon.slice(n);
  return { drawn, remaining };
}

function pushLog(log: string[], entry: string): string[] {
  return [...log, entry];
}

function beginRoom(state: GameState, viaRun = false): GameState {
  const s: GameState = { ...state, log: state.log };

  if (s.carryover === null) {
    const { drawn, remaining } = drawFrom(s.dungeon, 4);
    s.dungeon = remaining;
    s.room = drawn;
  } else {
    const n = Math.min(3, s.dungeon.length);
    const { drawn, remaining } = drawFrom(s.dungeon, n);
    s.dungeon = remaining;
    s.room = [s.carryover, ...drawn];
    s.carryover = null;
  }

  s.resolvedCount = 0;
  s.requiredResolves = s.room.length < 4 ? s.room.length : RESOLVES_PER_ROOM;
  s.dealtSize = s.room.length;
  s.potionUsedThisRoom = false;
  s.ranLastRoom = viaRun;
  s.roomComplete = false;

  if (viaRun) {
    s.log = pushLog(s.log, 'You flee the room; the four cards sink to the bottom of the dungeon.');
  }
  const dealtMsg =
    s.room.length < 4
      ? `Final room dealt with ${s.room.length} card(s): ${s.room.map(cardName).join(', ')}.`
      : `Room dealt: ${s.room.map(cardName).join(', ')}.`;
  s.log = pushLog(s.log, dealtMsg);
  return s;
}

export function createInitialState(seed?: number): GameState {
  const resolvedSeed = seed ?? randomSeed();
  const rng = mulberry32(resolvedSeed);
  const dungeon = shuffle(buildDungeon(), rng);

  const base: GameState = {
    phase: 'playing',
    health: HEALTH_MAX,
    maxHealth: HEALTH_MAX,
    dungeon,
    room: [],
    carryover: null,
    weapon: null,
    discard: [],
    resolvedCount: 0,
    requiredResolves: RESOLVES_PER_ROOM,
    dealtSize: 0,
    potionUsedThisRoom: false,
    ranLastRoom: false,
    roomComplete: false,
    score: null,
    log: [],
    seed: resolvedSeed,
  };
  return beginRoom(base);
}

function removeFromRoom(room: Card[], cardId: string): Card[] {
  return room.filter((c) => c.id !== cardId);
}

function findInRoom(room: Card[], cardId: string): Card | undefined {
  return room.find((c) => c.id === cardId);
}

function endLoss(s: GameState): GameState {
  const sum = monsterValuesSum(s.dungeon);
  const score = sum === 0 ? 0 : -sum;
  return {
    ...s,
    phase: 'lost',
    score,
    log: pushLog(s.log, `You fall in the dungeon. Final score: ${score}.`),
  };
}

function endWin(s: GameState): GameState {
  return {
    ...s,
    phase: 'won',
    score: s.health,
    roomComplete: true,
    log: pushLog(s.log, `Dungeon cleared! Final score: ${s.health}.`),
  };
}

function afterResolve(state: GameState): GameState {
  const s = { ...state };

  if (s.health <= 0) {
    return endLoss(s);
  }

  if (s.resolvedCount >= s.requiredResolves) {
    if (s.dealtSize < 4) {
      return endWin(s);
    }
    // Normal room complete: hold the single leftover card as carryover.
    const leftover = s.room[0];
    s.roomComplete = true;
    if (leftover) {
      s.carryover = leftover;
      s.room = [];
      s.log = pushLog(s.log, `Room cleared. ${cardName(leftover)} carries over to the next room.`);
    }
  }
  return s;
}

function fightBarehanded(state: GameState, cardId: string): GameState {
  if (state.phase !== 'playing' || state.roomComplete) return state;
  const monster = findInRoom(state.room, cardId);
  if (!monster || cardKind(monster) !== 'monster') return state;
  if (state.resolvedCount >= state.requiredResolves) return state;

  const damage = monster.value;
  const s: GameState = {
    ...state,
    health: state.health - damage,
    room: removeFromRoom(state.room, cardId),
    discard: [...state.discard, monster],
    resolvedCount: state.resolvedCount + 1,
    log: pushLog(state.log, `Barehanded strike vs ${cardName(monster)}: took ${damage} damage.`),
  };
  return afterResolve(s);
}

function fightWithWeapon(state: GameState, cardId: string): GameState {
  if (state.phase !== 'playing' || state.roomComplete) return state;
  const monster = findInRoom(state.room, cardId);
  if (!monster || cardKind(monster) !== 'monster') return state;
  if (!canUseWeapon(state.weapon, monster.value)) return state;
  if (state.resolvedCount >= state.requiredResolves) return state;

  const weapon = state.weapon as { card: Card; slain: Card[]; lastKilledValue: number | null };
  const damage = combatDamage(weapon.card.value, monster.value);
  const newWeapon: EquippedWeapon = {
    card: weapon.card,
    slain: [...weapon.slain, monster],
    lastKilledValue: monster.value,
  };
  const s: GameState = {
    ...state,
    health: state.health - damage,
    room: removeFromRoom(state.room, cardId),
    weapon: newWeapon,
    resolvedCount: state.resolvedCount + 1,
    log: pushLog(
      state.log,
      `Weapon ${cardName(weapon.card)} slays ${cardName(monster)}; took ${damage} damage.`,
    ),
  };
  return afterResolve(s);
}

function equipWeapon(state: GameState, cardId: string): GameState {
  if (state.phase !== 'playing' || state.roomComplete) return state;
  const card = findInRoom(state.room, cardId);
  if (!card || cardKind(card) !== 'weapon') return state;
  if (state.resolvedCount >= state.requiredResolves) return state;

  const discard = state.weapon ? [...state.discard, state.weapon.card, ...state.weapon.slain] : [...state.discard];
  const newWeapon: EquippedWeapon = { card, slain: [], lastKilledValue: null };
  const previous = state.weapon ? ` Discards ${cardName(state.weapon.card)}.` : '';
  const s: GameState = {
    ...state,
    room: removeFromRoom(state.room, cardId),
    weapon: newWeapon,
    discard,
    resolvedCount: state.resolvedCount + 1,
    log: pushLog(state.log, `Equipped ${cardName(card)} as a weapon.${previous}`),
  };
  return afterResolve(s);
}

function drinkPotion(state: GameState, cardId: string): GameState {
  if (state.phase !== 'playing' || state.roomComplete) return state;
  const card = findInRoom(state.room, cardId);
  if (!card || cardKind(card) !== 'potion') return state;
  if (state.resolvedCount >= state.requiredResolves) return state;

  const usedAlready = state.potionUsedThisRoom;
  const heal = usedAlready ? 0 : healAmount(state.health, card.value, state.maxHealth);
  const s: GameState = {
    ...state,
    health: state.health + heal,
    room: removeFromRoom(state.room, cardId),
    discard: [...state.discard, card],
    resolvedCount: state.resolvedCount + 1,
    potionUsedThisRoom: true,
    log: pushLog(
      state.log,
      usedAlready
        ? `Extra potion ${cardName(card)} fizzles (one per room).`
        : `Drank ${cardName(card)}: restored ${heal} health.`,
    ),
  };
  return afterResolve(s);
}

function run(state: GameState): GameState {
  if (!canRun(state)) return state;
  const s: GameState = { ...state, dungeon: [...state.dungeon, ...state.room], room: [] };
  return beginRoom(s, true);
}

function dealNextRoom(state: GameState): GameState {
  if (state.phase !== 'playing' || !state.roomComplete || state.dealtSize < 4) return state;
  return beginRoom({ ...state }, false);
}

export function reducer(state: GameState | undefined, action: Action): GameState {
  if (!state || action.type === 'NEW_GAME') {
    return createInitialState(action.type === 'NEW_GAME' ? action.seed : undefined);
  }
  switch (action.type) {
    case 'RUN':
      return run(state);
    case 'DEAL_NEXT_ROOM':
      return dealNextRoom(state);
    case 'FIGHT_BAREHANDED':
      return fightBarehanded(state, action.cardId);
    case 'FIGHT_WITH_WEAPON':
      return fightWithWeapon(state, action.cardId);
    case 'EQUIP_WEAPON':
      return equipWeapon(state, action.cardId);
    case 'DRINK_POTION':
      return drinkPotion(state, action.cardId);
    default:
      return state;
  }
}

export function totalMonsterValueInDungeon(state: GameState): number {
  return monsterValuesSum(state.dungeon);
}

export function weaponSlainCount(state: GameState): number {
  return state.weapon ? state.weapon.slain.length : 0;
}