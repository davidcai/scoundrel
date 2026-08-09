import { describe, it, expect } from 'vitest';
import {
  buildDeck,
  cardRole,
  shuffle,
  createGame,
  reduce,
  canRun,
  canFightWithWeapon,
  requiredResolves,
} from './index';
import type { Card, GameState } from './types';

const MAX_HEALTH = 20;

function forceRoom(state: GameState, cards: Card[]): GameState {
  return { ...state, room: [...cards], resolvedThisRoom: 0, potionsUsedThisRoom: 0 };
}

function makeCard(suit: Card['suit'], rank: number): Card {
  return { id: `${suit}-${rank}`, suit, rank: rank as Card['rank'], value: rank };
}

const C = (r: number) => makeCard('clubs', r);
const S = (r: number) => makeCard('spades', r);
const D = (r: number) => makeCard('diamonds', r);
const H = (r: number) => makeCard('hearts', r);

describe('deck', () => {
  it('has exactly 44 cards', () => {
    expect(buildDeck()).toHaveLength(44);
  });

  it('has correct suits and ranks (no red face cards, no red aces)', () => {
    const deck = buildDeck();
    expect(deck.filter((c) => c.suit === 'hearts').map((c) => c.rank)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(deck.filter((c) => c.suit === 'diamonds').map((c) => c.rank)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(deck.filter((c) => c.suit === 'clubs').map((c) => c.rank)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(deck.filter((c) => c.suit === 'spades').map((c) => c.rank)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
  });

  it('has unique ids', () => {
    expect(new Set(buildDeck().map((c) => c.id)).size).toBe(44);
  });

  it('cardRole is correct for each suit', () => {
    expect(cardRole(C(5))).toBe('monster');
    expect(cardRole(S(14))).toBe('monster');
    expect(cardRole(D(7))).toBe('weapon');
    expect(cardRole(H(3))).toBe('potion');
  });
});

describe('shuffle', () => {
  it('is deterministic with a seed', () => {
    const deck = buildDeck();
    expect(shuffle(deck, 42)).toEqual(shuffle(deck, 42));
  });

  it('differs across seeds (very likely)', () => {
    const deck = buildDeck();
    expect(shuffle(deck, 1)).not.toEqual(shuffle(deck, 2));
  });

  it('preserves all cards', () => {
    const shuffled = shuffle(buildDeck(), 7);
    expect(shuffled.length).toBe(44);
    expect(new Set(shuffled.map((c) => c.id)).size).toBe(44);
  });
});

describe('createGame', () => {
  it('starts with health 20, room of 4, deck of 40, status playing', () => {
    const g = createGame(1);
    expect(g.health).toBe(MAX_HEALTH);
    expect(g.room).toHaveLength(4);
    expect(g.deck).toHaveLength(40);
    expect(g.status).toBe('playing');
    expect(g.weapon).toBeNull();
    expect(g.enteredByRun).toBe(false);
    expect(g.roomId).toBe(1);
  });
});

describe('fight barehanded', () => {
  it('deals full monster value as damage and removes the monster', () => {
    let g = createGame(1);
    const monster = C(7);
    g = forceRoom(g, [monster, H(3), D(5), S(2)]);
    const before = g.health;
    g = reduce(g, { type: 'fight', cardId: monster.id, useWeapon: false });
    expect(g.health).toBe(before - monster.value);
    expect(g.room.find((c) => c.id === monster.id)).toBeUndefined();
    expect(g.resolvedThisRoom).toBe(1);
  });
});

describe('fight with weapon', () => {
  it('deals max(0, monster - weapon) damage and stacks the monster', () => {
    let g = createGame(1);
    const weapon = D(8);
    const monster = C(5);
    g = forceRoom(g, [weapon, monster, H(3), S(2)]);
    g = reduce(g, { type: 'equip', cardId: weapon.id });
    const before = g.health;
    g = reduce(g, { type: 'fight', cardId: monster.id, useWeapon: true });
    expect(g.health).toBe(before - Math.max(0, monster.value - weapon.value));
    expect(g.weapon!.stack).toContainEqual(monster);
    expect(g.weapon!.lastKilledValue).toBe(monster.value);
  });
});

describe('weapon degradation', () => {
  it('cannot use weapon on monster with value >= lastKilledValue', () => {
    let g = createGame(1);
    const weapon = D(10);
    const m1 = C(5);
    const m2 = S(5);
    g = forceRoom(g, [weapon, m1, m2, H(2)]);
    g = reduce(g, { type: 'equip', cardId: weapon.id });
    g = reduce(g, { type: 'fight', cardId: m1.id, useWeapon: true });
    expect(g.weapon!.lastKilledValue).toBe(5);
    expect(canFightWithWeapon(g, m2.id)).toBe(false);
    const before = g.health;
    expect(reduce(g, { type: 'fight', cardId: m2.id, useWeapon: true })).toBe(g);
    expect(g.health).toBe(before);
  });

  it('can use weapon on monster with value < lastKilledValue', () => {
    let g = createGame(1);
    const weapon = D(10);
    const m1 = C(6);
    const m2 = S(4);
    g = forceRoom(g, [weapon, m1, m2, H(2)]);
    g = reduce(g, { type: 'equip', cardId: weapon.id });
    g = reduce(g, { type: 'fight', cardId: m1.id, useWeapon: true });
    expect(canFightWithWeapon(g, m2.id)).toBe(true);
    const before = g.health;
    g = reduce(g, { type: 'fight', cardId: m2.id, useWeapon: true });
    expect(g.health).toBe(before);
    expect(g.weapon!.lastKilledValue).toBe(4);
  });

  it('fresh weapon (lastKilledValue null) can fight any monster', () => {
    let g = createGame(1);
    const weapon = D(2);
    const monster = S(14);
    g = forceRoom(g, [weapon, monster, H(2), C(3)]);
    g = reduce(g, { type: 'equip', cardId: weapon.id });
    expect(canFightWithWeapon(g, monster.id)).toBe(true);
    const before = g.health;
    g = reduce(g, { type: 'fight', cardId: monster.id, useWeapon: true });
    expect(g.health).toBe(before - (14 - 2));
  });
});

describe('equip', () => {
  it('discards old weapon and its stack', () => {
    let g = createGame(1);
    const w1 = D(10);
    const m1 = C(5);
    const w2 = D(8);
    g = forceRoom(g, [w1, m1, w2, H(2)]);
    g = reduce(g, { type: 'equip', cardId: w1.id });
    g = reduce(g, { type: 'fight', cardId: m1.id, useWeapon: true });
    expect(g.weapon!.stack).toHaveLength(1);
    g = reduce(g, { type: 'equip', cardId: w2.id });
    expect(g.weapon!.card).toEqual(w2);
    expect(g.weapon!.stack).toHaveLength(0);
    expect(g.weapon!.lastKilledValue).toBeNull();
  });
});

describe('potions', () => {
  it('first potion in a room heals, capped at 20', () => {
    let g = createGame(1);
    g = forceRoom(g, [C(8), H(6), D(2), S(3)]);
    g = reduce(g, { type: 'fight', cardId: C(8).id, useWeapon: false });
    expect(g.health).toBe(MAX_HEALTH - 8);
    g = reduce(g, { type: 'drink', cardId: H(6).id });
    expect(g.health).toBe(MAX_HEALTH - 8 + 6);
  });

  it('health never exceeds 20', () => {
    let g = createGame(1);
    const potion = H(10);
    g = forceRoom(g, [potion, C(2), S(3), D(4)]);
    g = reduce(g, { type: 'drink', cardId: potion.id });
    expect(g.health).toBe(MAX_HEALTH);
  });

  it('second potion in same room heals 0 but still counts as a resolve', () => {
    let g = createGame(1);
    const monster = C(5);
    const p1 = H(4);
    const p2 = H(7);
    g = forceRoom(g, [monster, p1, p2, S(2)]);
    g = reduce(g, { type: 'fight', cardId: monster.id, useWeapon: false });
    const healthAfterFight = g.health;
    g = reduce(g, { type: 'drink', cardId: p1.id });
    expect(g.health).toBe(healthAfterFight + 4);
    g = reduce(g, { type: 'drink', cardId: p2.id });
    expect(g.health).toBe(healthAfterFight + 4);
    // p2 was removed (action accepted) and 3 resolves triggered a new room
    expect(g.room.find((c) => c.id === p2.id)).toBeUndefined();
    expect(g.roomId).toBe(2);
  });

  it('potion count resets between rooms', () => {
    let g = createGame(1);
    const m1 = C(2);
    const m2 = S(2);
    const m3 = C(2);
    const p1 = H(3);
    g = forceRoom(g, [m1, m2, m3, p1]);
    g = reduce(g, { type: 'fight', cardId: m1.id, useWeapon: false });
    g = reduce(g, { type: 'fight', cardId: m2.id, useWeapon: false });
    g = reduce(g, { type: 'drink', cardId: p1.id });
    // After 3 resolves, new room dealt; counters reset
    expect(g.roomId).toBe(2);
    expect(g.potionsUsedThisRoom).toBe(0);
    expect(g.resolvedThisRoom).toBe(0);
    expect(g.room).toHaveLength(4);
  });
});

describe('run', () => {
  it('moves all 4 cards to bottom of deck and deals a new room', () => {
    let g = createGame(1);
    const roomCards = [...g.room];
    const deckBefore = g.deck.length;
    g = reduce(g, { type: 'run' });
    expect(g.room).toHaveLength(4);
    expect(g.deck.length).toBe(deckBefore);
    expect(g.enteredByRun).toBe(true);
    expect(g.deck.slice(-4)).toEqual(roomCards);
  });

  it('cannot run two rooms in a row', () => {
    let g = createGame(1);
    g = reduce(g, { type: 'run' });
    expect(canRun(g)).toBe(false);
    expect(reduce(g, { type: 'run' })).toBe(g);
  });

  it('can run again after resolving through to the next room', () => {
    let g = createGame(1);
    g = reduce(g, { type: 'run' });
    expect(canRun(g)).toBe(false);
    g = forceRoom(g, [C(2), S(3), C(4), H(5)]);
    g = reduce(g, { type: 'fight', cardId: C(2).id, useWeapon: false });
    g = reduce(g, { type: 'fight', cardId: S(3).id, useWeapon: false });
    g = reduce(g, { type: 'fight', cardId: C(4).id, useWeapon: false });
    expect(g.status).toBe('playing');
    expect(canRun(g)).toBe(true);
  });
});

describe('carry-over', () => {
  it('leaves 1 card that becomes part of the next room', () => {
    let g = createGame(1);
    const carry = H(5);
    g = forceRoom(g, [C(2), S(3), C(4), carry]);
    g = reduce(g, { type: 'fight', cardId: C(2).id, useWeapon: false });
    g = reduce(g, { type: 'fight', cardId: S(3).id, useWeapon: false });
    g = reduce(g, { type: 'fight', cardId: C(4).id, useWeapon: false });
    expect(g.status).toBe('playing');
    expect(g.roomId).toBe(2);
    expect(g.room).toHaveLength(4);
    expect(g.room[0]).toEqual(carry);
  });
});

describe('win', () => {
  it('wins when final room is fully resolved, score = health', () => {
    let g = createGame(1);
    g = { ...g, deck: [], room: [C(2)], isFinalRoom: true, roomSize: 1 };
    const before = g.health;
    g = reduce(g, { type: 'fight', cardId: C(2).id, useWeapon: false });
    expect(g.status).toBe('won');
    expect(g.score).toBe(before - 2);
  });
});

describe('lose', () => {
  it('loses when health drops to <= 0, score = -(sum of remaining monster values in deck)', () => {
    let g = createGame(1);
    g = { ...g, deck: [S(7)], room: [C(20)], health: 5 };
    g = reduce(g, { type: 'fight', cardId: C(20).id, useWeapon: false });
    expect(g.status).toBe('lost');
    expect(g.score).toBe(-7);
  });
});

describe('final room', () => {
  it('isFinalRoom true when deck empties during a deal; requires resolving ALL cards', () => {
    let g = createGame(1);
    g = { ...g, deck: [], room: [C(2), S(3)], isFinalRoom: true, roomSize: 2 };
    g = reduce(g, { type: 'fight', cardId: C(2).id, useWeapon: false });
    expect(g.status).toBe('playing');
    expect(g.resolvedThisRoom).toBe(1);
    g = reduce(g, { type: 'fight', cardId: S(3).id, useWeapon: false });
    expect(g.status).toBe('won');
  });
});

describe('invalid actions', () => {
  it('fight on a non-monster leaves state unchanged', () => {
    let g = createGame(1);
    const potion = H(5);
    g = forceRoom(g, [potion, C(3), S(2), D(8)]);
    const before = g;
    expect(reduce(g, { type: 'fight', cardId: potion.id, useWeapon: false })).toBe(before);
  });

  it('equip on a non-weapon leaves state unchanged', () => {
    let g = createGame(1);
    const monster = C(5);
    g = forceRoom(g, [monster, H(3), S(2), D(8)]);
    const before = g;
    expect(reduce(g, { type: 'equip', cardId: monster.id })).toBe(before);
  });

  it('drink on a non-potion leaves state unchanged', () => {
    let g = createGame(1);
    const monster = C(5);
    g = forceRoom(g, [monster, H(3), S(2), D(8)]);
    const before = g;
    expect(reduce(g, { type: 'drink', cardId: monster.id })).toBe(before);
  });

  it('fight with degraded weapon on too-strong monster leaves state unchanged', () => {
    let g = createGame(1);
    const weapon = D(10);
    const m1 = C(6);
    const m2 = S(8);
    g = forceRoom(g, [weapon, m1, m2, H(2)]);
    g = reduce(g, { type: 'equip', cardId: weapon.id });
    g = reduce(g, { type: 'fight', cardId: m1.id, useWeapon: true });
    const before = g;
    expect(reduce(g, { type: 'fight', cardId: m2.id, useWeapon: true })).toBe(before);
  });
});

describe('purity', () => {
  it('reduce does not mutate input state', () => {
    let g = createGame(1);
    const monster = C(5);
    g = forceRoom(g, [monster, H(3), S(2), D(8)]);
    const snapshot = JSON.stringify(g);
    reduce(g, { type: 'fight', cardId: monster.id, useWeapon: false });
    expect(JSON.stringify(g)).toBe(snapshot);
  });
});

describe('requiredResolves', () => {
  it('returns 3 for a normal room', () => {
    expect(requiredResolves(createGame(1))).toBe(3);
  });

  it('returns roomSize for a final room', () => {
    const g = { ...createGame(1), isFinalRoom: true, roomSize: 2 };
    expect(requiredResolves(g)).toBe(2);
  });
});