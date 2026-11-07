import { getCard, lossScore } from './cards';
import { DEFAULT_CONFIG, shuffledDeck, validateConfig, validateSeed } from './replay';
import type {
  Action,
  ActionResult,
  GameConfig,
  GameState,
  InvalidReason,
  PlayingState,
  RoomState,
  Transition,
} from './types';

function playing(seed: string, config: GameConfig, board: RoomState): PlayingState {
  return { seed, config, board, status: 'playing', roomStart: board };
}
export function createGame(seed: string, config: GameConfig = DEFAULT_CONFIG): PlayingState {
  validateSeed(seed);
  const validConfig = validateConfig(config);
  const deck = shuffledDeck(seed);
  return playing(seed, validConfig, {
    health: 20,
    dungeon: deck.slice(4),
    room: deck.slice(0, 4),
    carriedCard: null,
    weapon: null,
    kills: [],
    discard: [],
    potionsUsed: 0,
    resolved: 0,
    previousRoomEscaped: false,
    highlights: { roomsExplored: 1, roomsCleared: 0, monstersDefeated: 0, potionsWasted: 0 },
  });
}
export function isRoomComplete(board: RoomState): boolean {
  return board.dungeon.length === 0 ? board.room.length === 0 : board.resolved === 3;
}
function resolve(state: PlayingState, board: RoomState, result: ActionResult): Transition {
  if (board.health <= 0)
    return {
      state: {
        seed: state.seed,
        config: state.config,
        board,
        status: 'lost',
        reason: 'death',
        score: lossScore(board.dungeon),
      },
      result,
    };
  if (isRoomComplete(board))
    board = {
      ...board,
      highlights: { ...board.highlights, roomsCleared: board.highlights.roomsCleared + 1 },
    };
  if (board.dungeon.length === 0 && board.room.length === 0)
    return {
      state: {
        seed: state.seed,
        config: state.config,
        board,
        status: 'won',
        reason: 'cleared',
        score: board.health,
      },
      result,
    };
  return { state: { ...state, board }, result };
}
export function transition(state: GameState, action: Action): Transition {
  const invalid = (reason: InvalidReason): Transition => ({
    state,
    result: { type: 'invalid', reason },
  });
  if (state.status !== 'playing') return invalid('run-ended');
  const b = state.board;
  if (action.type === 'abandon')
    return {
      state: {
        seed: state.seed,
        config: state.config,
        board: b,
        status: 'lost',
        reason: 'abandoned',
        score: lossScore(b.dungeon),
      },
      result: { type: 'abandoned' },
    };
  if (action.type === 'undo') {
    if (b.resolved === 0) return invalid('nothing-to-undo');
    return { state: { ...state, board: state.roomStart }, result: { type: 'undone' } };
  }
  if (action.type === 'escape') {
    if (b.dungeon.length === 0) return invalid('final-room');
    if (b.resolved !== 0) return invalid('escape-after-resolution');
    if (b.previousRoomEscaped && !state.config.allowConsecutiveEscapes)
      return invalid('consecutive-escape');
    const deck = [...b.dungeon, ...b.room];
    const board = {
      ...b,
      dungeon: deck.slice(4),
      room: deck.slice(0, 4),
      carriedCard: null,
      potionsUsed: 0,
      resolved: 0,
      previousRoomEscaped: true,
      highlights: { ...b.highlights, roomsExplored: b.highlights.roomsExplored + 1 },
    };
    return { state: playing(state.seed, state.config, board), result: { type: 'escaped' } };
  }
  if (action.type === 'next-room') {
    if (!isRoomComplete(b)) return invalid('room-incomplete');
    const count = Math.min(3, b.dungeon.length);
    const board: RoomState = {
      ...b,
      room: [...b.room, ...b.dungeon.slice(0, count)],
      dungeon: b.dungeon.slice(count),
      carriedCard: b.room[0] ?? null,
      resolved: 0,
      potionsUsed: 0,
      previousRoomEscaped: false,
      highlights: { ...b.highlights, roomsExplored: b.highlights.roomsExplored + 1 },
    };
    return { state: playing(state.seed, state.config, board), result: { type: 'entered-room' } };
  }
  if (isRoomComplete(b)) return invalid('room-complete');
  if (!b.room.includes(action.cardId)) return invalid('card-not-in-room');
  const card = getCard(action.cardId);
  const base: RoomState = {
    ...b,
    room: b.room.filter((id) => id !== card.id),
    resolved: b.resolved + 1,
    carriedCard: b.carriedCard === card.id ? null : b.carriedCard,
  };
  switch (action.type) {
    case 'fight': {
      if (card.kind !== 'monster') return invalid('wrong-card-type');
      if (action.mode === 'weapon') {
        if (!b.weapon) return invalid('weapon-required');
        const lastKill = b.kills.at(-1);
        if (state.config.weaponDegradation && lastKill && card.value >= getCard(lastKill).value)
          return invalid('weapon-degraded');
      }
      const damage =
        action.mode === 'weapon' && b.weapon
          ? Math.max(0, card.value - getCard(b.weapon).value)
          : card.value;
      const health = b.health - damage;
      const board = {
        ...base,
        health,
        kills: action.mode === 'weapon' ? [...b.kills, card.id] : b.kills,
        discard: action.mode === 'barehanded' ? [...b.discard, card.id] : b.discard,
        highlights: {
          ...b.highlights,
          monstersDefeated: b.highlights.monstersDefeated + (health > 0 ? 1 : 0),
        },
      };
      return resolve(state, board, {
        type: 'fought',
        cardId: card.id,
        mode: action.mode,
        damage,
        healthAfter: health,
      });
    }
    case 'equip': {
      if (card.kind !== 'weapon') return invalid('wrong-card-type');
      const discarded = b.weapon ? [b.weapon, ...b.kills] : [];
      return resolve(
        state,
        { ...base, weapon: card.id, kills: [], discard: [...b.discard, ...discarded] },
        { type: 'equipped', cardId: card.id, discarded },
      );
    }
    case 'drink': {
      if (card.kind !== 'potion') return invalid('wrong-card-type');
      const healed =
        b.potionsUsed === 0 || state.config.unlimitedPotions
          ? Math.min(card.value, 20 - b.health)
          : 0;
      const wasted = healed === 0;
      const health = b.health + healed;
      return resolve(
        state,
        {
          ...base,
          health,
          potionsUsed: b.potionsUsed + 1,
          discard: [...b.discard, card.id],
          highlights: {
            ...b.highlights,
            potionsWasted: b.highlights.potionsWasted + (wasted ? 1 : 0),
          },
        },
        { type: 'drank', cardId: card.id, healed, wasted, healthAfter: health },
      );
    }
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}
export function previewAction(state: GameState, action: Action): ActionResult {
  return transition(state, action).result;
}
