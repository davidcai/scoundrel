import { buildDungeon, mulberry32, randomSeed, shuffle } from './deck';
import {
  canWeaponFight,
  cardLabel,
  fightDamage,
  isMonster,
  isPotion,
  isWeapon,
  lossScore,
} from './rules';
import type { Card, GameAction, GameState } from './types';
import { MAX_HEALTH } from './types';

const ROOM_SIZE = 4;

export function createGame(seed: number = randomSeed()): GameState {
  const deck = shuffle(buildDungeon(), mulberry32(seed));
  const state: GameState = {
    deck,
    room: [],
    health: MAX_HEALTH,
    weapon: null,
    discard: [],
    potionUsed: false,
    ranLastRoom: false,
    status: 'playing',
    score: null,
    log: ['You enter the dungeon. 44 cards stand between you and freedom.'],
    seed,
  };
  return {
    ...state,
    deck: deck.slice(ROOM_SIZE),
    room: deck.slice(0, ROOM_SIZE),
  };
}

/**
 * After a card is resolved: end the game if the room and deck are both
 * exhausted, otherwise top the room back up to 4 once only one card remains.
 * While the deck is empty the "leave one card behind" rule lapses — every
 * remaining card must be resolved to clear the dungeon.
 */
function advanceRoom(state: GameState): GameState {
  if (state.status !== 'playing') return state;
  if (state.room.length === 0 && state.deck.length === 0) {
    return {
      ...state,
      status: 'won',
      score: state.health,
      log: [...state.log, `Dungeon cleared! Final score: ${state.health}.`],
    };
  }
  if (state.room.length === 1 && state.deck.length > 0) {
    const drawn = state.deck.slice(0, ROOM_SIZE - 1);
    return {
      ...state,
      deck: state.deck.slice(drawn.length),
      room: [...state.room, ...drawn],
      potionUsed: false,
      ranLastRoom: false,
    };
  }
  return state;
}

function die(state: GameState): GameState {
  const score = lossScore(state);
  return {
    ...state,
    status: 'lost',
    score,
    log: [...state.log, `You died in the dark. Final score: ${score}.`],
  };
}

function roomCard(state: GameState, cardId: string): Card | null {
  return state.room.find((c) => c.id === cardId) ?? null;
}

function withoutRoomCard(state: GameState, card: Card): Card[] {
  return state.room.filter((c) => c.id !== card.id);
}

function drink(state: GameState, cardId: string): GameState {
  const card = roomCard(state, cardId);
  if (!card || !isPotion(card)) return state;
  const room = withoutRoomCard(state, card);
  if (state.potionUsed) {
    return advanceRoom({
      ...state,
      room,
      discard: [...state.discard, card],
      log: [
        ...state.log,
        `Discarded ${cardLabel(card)} — one potion per room, and you already drank.`,
      ],
    });
  }
  const healed = Math.min(card.value, MAX_HEALTH - state.health);
  return advanceRoom({
    ...state,
    room,
    health: state.health + healed,
    potionUsed: true,
    discard: [...state.discard, card],
    log: [...state.log, `Drank ${cardLabel(card)}: +${healed} health.`],
  });
}

function equip(state: GameState, cardId: string): GameState {
  const card = roomCard(state, cardId);
  if (!card || !isWeapon(card)) return state;
  const room = withoutRoomCard(state, card);
  const discarded = state.weapon
    ? [state.weapon.card, ...state.weapon.kills]
    : [];
  return advanceRoom({
    ...state,
    room,
    weapon: { card, kills: [] },
    discard: [...state.discard, ...discarded],
    log: [
      ...state.log,
      discarded.length > 0
        ? `Equipped ${cardLabel(card)}, dropping the old weapon.`
        : `Equipped ${cardLabel(card)}.`,
    ],
  });
}

function fight(state: GameState, cardId: string, useWeapon: boolean): GameState {
  const card = roomCard(state, cardId);
  if (!card || !isMonster(card)) return state;
  if (useWeapon && (!state.weapon || !canWeaponFight(state.weapon, card))) {
    return state; // illegal: no weapon, or monster not weaker than last kill
  }
  const room = withoutRoomCard(state, card);
  const damage = fightDamage(card, state.weapon, useWeapon);
  const health = state.health - damage;

  let next: GameState;
  if (useWeapon && state.weapon) {
    next = {
      ...state,
      room,
      health,
      weapon: {
        card: state.weapon.card,
        kills: [...state.weapon.kills, card],
      },
      log: [
        ...state.log,
        `${cardLabel(state.weapon.card)} slew ${cardLabel(card)}: -${damage} health.`,
      ],
    };
  } else {
    next = {
      ...state,
      room,
      health,
      discard: [...state.discard, card],
      log: [
        ...state.log,
        `Fought ${cardLabel(card)} barehanded: -${damage} health.`,
      ],
    };
  }

  if (next.health <= 0) return die(next);
  return advanceRoom(next);
}

function run(state: GameState): GameState {
  if (state.ranLastRoom || state.room.length !== ROOM_SIZE) return state;
  const deck = [...state.deck, ...state.room];
  return {
    ...state,
    deck: deck.slice(ROOM_SIZE),
    room: deck.slice(0, ROOM_SIZE),
    potionUsed: false,
    ranLastRoom: true,
    log: [...state.log, 'You fled. The room sinks to the bottom of the deck.'],
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  if (action.type === 'restart') {
    return createGame(action.seed ?? randomSeed());
  }
  if (state.status !== 'playing') return state;
  switch (action.type) {
    case 'drink':
      return drink(state, action.cardId);
    case 'equip':
      return equip(state, action.cardId);
    case 'fight':
      return fight(state, action.cardId, action.useWeapon);
    case 'run':
      return run(state);
  }
}
