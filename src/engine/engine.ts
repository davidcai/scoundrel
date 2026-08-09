import { buildDeck, cardRole, shuffle } from './deck';
import type { Action, Card, GameState, LogEntry, LogKind, Weapon } from './types';

const MAX_HEALTH = 20;
const ROOM_SIZE = 4;
const RESOLVES_PER_ROOM = 3;

function cardName(card: Card): string {
  const rankName =
    card.rank === 11 ? 'J'
    : card.rank === 12 ? 'Q'
    : card.rank === 13 ? 'K'
    : card.rank === 14 ? 'A'
    : String(card.rank);
  const suitName =
    card.suit === 'clubs' ? '\u2663'
    : card.suit === 'spades' ? '\u2660'
    : card.suit === 'diamonds' ? '\u2666'
    : '\u2665';
  return `${rankName}${suitName}`;
}

function addLog(log: LogEntry[], kind: LogKind, text: string): LogEntry[] {
  const id = log.length === 0 ? 1 : log[log.length - 1].id + 1;
  return [...log, { id, kind, text }];
}

function sumMonsterValues(deck: Card[]): number {
  return deck
    .filter((c) => cardRole(c) === 'monster')
    .reduce((sum, c) => sum + c.value, 0);
}

function dealRoom(state: GameState, enteredByRun: boolean): GameState {
  const deck = [...state.deck];
  const room = [...state.room];
  const drawCount = ROOM_SIZE - room.length;
  for (let i = 0; i < drawCount && deck.length > 0; i++) {
    room.push(deck.shift()!);
  }
  return {
    ...state,
    deck,
    room,
    roomSize: room.length,
    isFinalRoom: deck.length === 0,
    resolvedThisRoom: 0,
    potionsUsedThisRoom: 0,
    enteredByRun,
    roomId: state.roomId + 1,
  };
}

function checkRoomComplete(state: GameState): GameState {
  if (state.isFinalRoom) {
    if (state.room.length === 0) {
      const score = Math.min(MAX_HEALTH, state.health);
      return {
        ...state,
        status: 'won',
        score,
        log: addLog(state.log, 'win', 'You cleared the dungeon!'),
      };
    }
    return state;
  }
  if (state.resolvedThisRoom >= RESOLVES_PER_ROOM) {
    const dealt = dealRoom(state, false);
    return { ...dealt, log: addLog(dealt.log, 'room', `Entering room ${dealt.roomId}`) };
  }
  return state;
}

function fight(state: GameState, action: Extract<Action, { type: 'fight' }>): GameState {
  if (state.status !== 'playing') return state;
  const card = state.room.find((c) => c.id === action.cardId);
  if (!card || cardRole(card) !== 'monster') return state;

  let health = state.health;
  let weapon = state.weapon;
  let log = state.log;

  if (action.useWeapon) {
    if (!weapon) return state;
    if (weapon.lastKilledValue !== null && card.value >= weapon.lastKilledValue) return state;
    const damage = Math.max(0, card.value - weapon.card.value);
    health -= damage;
    weapon = { ...weapon, lastKilledValue: card.value, stack: [...weapon.stack, card] };
    log = addLog(
      log,
      'fight',
      `Fought ${cardName(card)} with ${cardName(weapon.card)}: ${damage} damage`,
    );
  } else {
    health -= card.value;
    log = addLog(log, 'fight', `Fought ${cardName(card)} barehanded: ${card.value} damage`);
  }

  const room = state.room.filter((c) => c.id !== action.cardId);
  let newState: GameState = {
    ...state,
    health,
    weapon,
    room,
    resolvedThisRoom: state.resolvedThisRoom + 1,
    log,
  };

  if (health <= 0) {
    const lostScore = -sumMonsterValues(newState.deck);
    return {
      ...newState,
      status: 'lost',
      score: lostScore,
      log: addLog(newState.log, 'lose', 'You died!'),
    };
  }

  return checkRoomComplete(newState);
}

function equip(state: GameState, action: Extract<Action, { type: 'equip' }>): GameState {
  if (state.status !== 'playing') return state;
  const card = state.room.find((c) => c.id === action.cardId);
  if (!card || cardRole(card) !== 'weapon') return state;

  const weapon: Weapon = { card, lastKilledValue: null, stack: [] };
  const room = state.room.filter((c) => c.id !== action.cardId);
  const log = addLog(state.log, 'weapon', `Equipped ${cardName(card)}`);
  const newState: GameState = {
    ...state,
    weapon,
    room,
    resolvedThisRoom: state.resolvedThisRoom + 1,
    log,
  };
  return checkRoomComplete(newState);
}

function drink(state: GameState, action: Extract<Action, { type: 'drink' }>): GameState {
  if (state.status !== 'playing') return state;
  const card = state.room.find((c) => c.id === action.cardId);
  if (!card || cardRole(card) !== 'potion') return state;

  let health = state.health;
  let log = state.log;

  if (state.potionsUsedThisRoom === 0) {
    health = Math.min(MAX_HEALTH, health + card.value);
    log = addLog(log, 'potion', `Drank ${cardName(card)}: +${card.value} health`);
  } else {
    log = addLog(log, 'potion', `Discarded ${cardName(card)} (extra potion, no heal)`);
  }

  const room = state.room.filter((c) => c.id !== action.cardId);
  const newState: GameState = {
    ...state,
    health,
    room,
    potionsUsedThisRoom: state.potionsUsedThisRoom + 1,
    resolvedThisRoom: state.resolvedThisRoom + 1,
    log,
  };
  return checkRoomComplete(newState);
}

function run(state: GameState): GameState {
  if (state.status !== 'playing') return state;
  if (state.enteredByRun) return state;
  if (state.room.length === 0) return state;
  if (state.resolvedThisRoom !== 0) return state;

  const deck = [...state.deck, ...state.room];
  const cleared: GameState = {
    ...state,
    deck,
    room: [],
    log: addLog(state.log, 'run', 'Ran from room'),
  };
  return dealRoom(cleared, true);
}

export function createGame(seed?: number): GameState {
  const deck = shuffle(buildDeck(), seed);
  const initial: GameState = {
    deck,
    room: [],
    health: MAX_HEALTH,
    weapon: null,
    resolvedThisRoom: 0,
    potionsUsedThisRoom: 0,
    enteredByRun: false,
    isFinalRoom: false,
    roomSize: 0,
    status: 'playing',
    score: null,
    roomId: 0,
    log: [],
  };
  const dealt = dealRoom(initial, false);
  return {
    ...dealt,
    log: addLog(dealt.log, 'info', `Entering room ${dealt.roomId}`),
  };
}

export function reduce(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'fight':
      return fight(state, action);
    case 'equip':
      return equip(state, action);
    case 'drink':
      return drink(state, action);
    case 'run':
      return run(state);
    case 'newGame':
      return createGame(action.seed);
    default:
      return state;
  }
}

export function canRun(state: GameState): boolean {
  return (
    !state.enteredByRun &&
    state.status === 'playing' &&
    state.room.length > 0 &&
    state.resolvedThisRoom === 0
  );
}

export function canFightWithWeapon(state: GameState, cardId: string): boolean {
  if (!state.weapon) return false;
  const card = state.room.find((c) => c.id === cardId);
  if (!card || cardRole(card) !== 'monster') return false;
  return state.weapon.lastKilledValue === null || card.value < state.weapon.lastKilledValue;
}

export function requiredResolves(state: GameState): number {
  return state.isFinalRoom ? state.roomSize : RESOLVES_PER_ROOM;
}