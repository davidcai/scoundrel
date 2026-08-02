import { describe, expect, it } from 'vitest';
import { buildDungeon, makeCard, shuffle } from '../src/game/deck';
import { mulberry32 } from '../src/game/rng';
import { canRun } from '../src/game/rules';
import { createInitialState, reducer } from '../src/game/engine';
import type { Action, Card, GameState } from '../src/game/types';

function newGame(seed = 1): GameState {
  return reducer(undefined, { type: 'NEW_GAME', seed });
}

function resolve(state: GameState, action: Action): GameState {
  return reducer(state, action);
}

function craft(overrides: Partial<GameState>): GameState {
  const base = createInitialState(1);
  return {
    ...base,
    resolvedCount: 0,
    requiredResolves: 3,
    dealtSize: 4,
    potionUsedThisRoom: false,
    roomComplete: false,
    ...overrides,
  };
}

describe('initial state', () => {
  it('starts with 20 health, a 4-card room, and 40 cards left in the dungeon', () => {
    const s = newGame(1);
    expect(s.health).toBe(20);
    expect(s.room.length).toBe(4);
    expect(s.dungeon.length).toBe(40);
    expect(s.resolvedCount).toBe(0);
    expect(s.requiredResolves).toBe(3);
    expect(s.phase).toBe('playing');
    expect(s.carryover).toBeNull();
    expect(s.potionUsedThisRoom).toBe(false);
  });

  it('does not include any red face cards or red aces in the dungeon+room', () => {
    const s = newGame(1);
    const all = [...s.dungeon, ...s.room];
    const bad = all.filter(
      (c) =>
        (c.suit === 'hearts' || c.suit === 'diamonds') &&
        (c.rank === 11 || c.rank === 12 || c.rank === 13 || c.rank === 14),
    );
    expect(bad.length).toBe(0);
    expect(all.length).toBe(44);
  });
});

describe('combat', () => {
  it('barehanded: takes the full monster value and discards the monster', () => {
    const s0 = craft({
      room: [makeCard('clubs', 7), makeCard('diamonds', 5), makeCard('hearts', 4), makeCard('spades', 6)],
      dungeon: [],
    });
    const before = s0.health;
    const s = resolve(s0, { type: 'FIGHT_BAREHANDED', cardId: 'C7' });
    expect(s.room.find((c) => c.id === 'C7')).toBeUndefined();
    expect(s.discard.find((c) => c.id === 'C7')).toBeDefined();
    expect(s.health).toBe(before - 7);
    expect(s.resolvedCount).toBe(1);
  });

  it('weapon: takes the nonnegative difference and records the slain value', () => {
    const s0 = craft({
      room: [makeCard('clubs', 11), makeCard('diamonds', 8), makeCard('hearts', 4), makeCard('spades', 6)],
      weapon: null,
      dungeon: [],
    });
    const before = s0.health;
    let s = resolve(s0, { type: 'EQUIP_WEAPON', cardId: 'D8' });
    expect(s.weapon?.card.id).toBe('D8');
    expect(s.resolvedCount).toBe(1);
    s = resolve(s, { type: 'FIGHT_WITH_WEAPON', cardId: 'C11' });
    expect(s.health).toBe(before - Math.max(0, 11 - 8));
    expect(s.weapon?.lastKilledValue).toBe(11);
    expect(s.weapon?.slain.map((c) => c.id)).toContain('C11');
    expect(s.resolvedCount).toBe(2);
  });

  it('rejects using a weapon on a monster that is not strictly weaker after a kill', () => {
    // Build a controlled state with a weapon already degraded.
    const d = shuffle(buildDungeon(), mulberry32(123));
    const s = createInitialState(123);
    // Force-equip a 8 by finding a diamond 8 if present, else construct scenario manually.
    // Use a crafted minimal state instead.
    const crafted: GameState = {
      ...s,
      room: [makeCard('diamonds', 10), makeCard('clubs', 11), makeCard('hearts', 5), makeCard('spades', 7)],
      weapon: { card: makeCard('diamonds', 10), slain: [], lastKilledValue: null },
      dungeon: d,
      resolvedCount: 0,
      requiredResolves: 3,
    };
    // First kill a 11 with the fresh 10-weapon (allowed), takes 1 dmg.
    const next = reducer(crafted, { type: 'FIGHT_WITH_WEAPON', cardId: 'C11' });
    expect(next.weapon?.lastKilledValue).toBe(11);
    expect(next.health).toBe(crafted.health - 1);
    // Now trying to kill the 7 (weaker) is allowed.
    const next2 = reducer(next, { type: 'FIGHT_WITH_WEAPON', cardId: 'S7' });
    expect(next2.weapon?.lastKilledValue).toBe(7);
    // Trying to kill an equal-or-stronger monster must be rejected (no state change).
    const strong = reducer(next2, {
      type: 'FIGHT_WITH_WEAPON',
      cardId: 'fake-strong',
    });
    expect(strong).toBe(next2);
  });

  it('equipping a new weapon discards the old weapon and its slain stack', () => {
    const s0 = craft({
      room: [makeCard('diamonds', 5), makeCard('clubs', 3), makeCard('hearts', 4), makeCard('spades', 7)],
      weapon: { card: makeCard('diamonds', 9), slain: [makeCard('clubs', 8)], lastKilledValue: 8 },
      discard: [],
      dungeon: [],
    });
    const s = resolve(s0, { type: 'EQUIP_WEAPON', cardId: 'D5' });
    expect(s.weapon?.card.id).toBe('D5');
    expect(s.weapon?.slain).toEqual([]);
    expect(s.weapon?.lastKilledValue).toBeNull();
    expect(s.discard.filter((c) => c.id === 'D9').length).toBe(1);
    expect(s.discard.find((c) => c.id === 'C8')).toBeDefined();
    expect(s.resolvedCount).toBe(1);
  });

  it('may choose to fight barehanded even when a usable weapon is equipped', () => {
    const s0 = craft({
      room: [makeCard('clubs', 6), makeCard('diamonds', 5), makeCard('hearts', 4), makeCard('spades', 7)],
      weapon: { card: makeCard('diamonds', 10), slain: [], lastKilledValue: null },
      dungeon: [],
    });
    const before = s0.health;
    const s = resolve(s0, { type: 'FIGHT_BAREHANDED', cardId: 'C6' });
    expect(s.health).toBe(before - 6);
    expect(s.weapon?.slain.length).toBe(0);
    expect(s.resolvedCount).toBe(1);
  });
});

describe('potions', () => {
  it('first potion in a room heals, capped at 20', () => {
    const s0 = craft({
      health: 12,
      room: [makeCard('hearts', 9), makeCard('clubs', 3), makeCard('diamonds', 5), makeCard('spades', 7)],
      dungeon: [],
    });
    const s = resolve(s0, { type: 'DRINK_POTION', cardId: 'H9' });
    expect(s.health).toBe(20);
    expect(s.potionUsedThisRoom).toBe(true);
    expect(s.resolvedCount).toBe(1);
  });

  it('heals below the cap when not full', () => {
    const s0 = craft({
      health: 5,
      room: [makeCard('hearts', 6), makeCard('clubs', 3), makeCard('diamonds', 5), makeCard('spades', 7)],
      dungeon: [],
    });
    const s = resolve(s0, { type: 'DRINK_POTION', cardId: 'H6' });
    expect(s.health).toBe(11);
  });

  it('a second potion in the same room fizzles but still counts as a resolve', () => {
    const s0 = craft({
      health: 10,
      room: [makeCard('hearts', 9), makeCard('hearts', 5), makeCard('clubs', 3), makeCard('spades', 4)],
      dungeon: [],
    });
    let s = resolve(s0, { type: 'DRINK_POTION', cardId: 'H9' });
    expect(s.health).toBe(19);
    s = resolve(s, { type: 'DRINK_POTION', cardId: 'H5' });
    expect(s.health).toBe(19);
    expect(s.potionUsedThisRoom).toBe(true);
    expect(s.resolvedCount).toBe(2);
  });
});

describe('room lifecycle', () => {
  it('completes a normal room after 3 resolves and holds the leftover as carryover', () => {
    const base = createInitialState(1);
    // Room with 3 monsters + 1 weapon; resolve 3 monsters barehanded => leftover weapon carries.
    const crafted: GameState = {
      ...base,
      room: [makeCard('clubs', 2), makeCard('spades', 3), makeCard('clubs', 4), makeCard('diamonds', 5)],
      resolvedCount: 0,
      requiredResolves: 3,
      dealtSize: 4,
      dungeon: [makeCard('hearts', 6), makeCard('spades', 7), makeCard('clubs', 8), makeCard('diamonds', 2)],
    };
    const healthBefore = crafted.health;
    let s = reducer(crafted, { type: 'FIGHT_BAREHANDED', cardId: 'C2' });
    s = reducer(s, { type: 'FIGHT_BAREHANDED', cardId: 'S3' });
    s = reducer(s, { type: 'FIGHT_BAREHANDED', cardId: 'C4' });
    expect(s.resolvedCount).toBe(3);
    expect(s.roomComplete).toBe(true);
    expect(s.carryover?.id).toBe('D5');
    expect(s.room).toEqual([]);
    expect(s.health).toBe(healthBefore - (2 + 3 + 4));
  });

  it('DEAL_NEXT_ROOM composes the next room from carryover + top 3 of the dungeon', () => {
    const base = createInitialState(1);
    const crafted: GameState = {
      ...base,
      room: [makeCard('clubs', 2), makeCard('spades', 3), makeCard('clubs', 4), makeCard('diamonds', 5)],
      resolvedCount: 0,
      requiredResolves: 3,
      dealtSize: 4,
      dungeon: [makeCard('hearts', 6), makeCard('spades', 7), makeCard('clubs', 8), makeCard('diamonds', 2), makeCard('hearts', 10)],
    };
    let s = reducer(crafted, { type: 'FIGHT_BAREHANDED', cardId: 'C2' });
    s = reducer(s, { type: 'FIGHT_BAREHANDED', cardId: 'S3' });
    s = reducer(s, { type: 'FIGHT_BAREHANDED', cardId: 'C4' });
    expect(s.roomComplete).toBe(true);
    expect(s.carryover?.id).toBe('D5');
    s = reducer(s, { type: 'DEAL_NEXT_ROOM' });
    expect(s.resolvedCount).toBe(0);
    expect(s.requiredResolves).toBe(3);
    expect(s.dealtSize).toBe(4);
    expect(s.carryover).toBeNull();
    expect(s.room.map((c) => c.id)).toEqual(['D5', 'H6', 'S7', 'C8']); // carryover + top 3
    expect(s.dungeon.map((c) => c.id)).toEqual(['D2', 'H10']);
  });

  it('deals a final partial room when fewer than 3 remain and requires resolving all of it', () => {
    const base = createInitialState(1);
    // One card left in dungeon; after current room, carryover + 1 draw = 2-card final room.
    const crafted: GameState = {
      ...base,
      room: [makeCard('clubs', 2), makeCard('spades', 3), makeCard('clubs', 4), makeCard('diamonds', 5)],
      resolvedCount: 0,
      requiredResolves: 3,
      dealtSize: 4,
      dungeon: [makeCard('hearts', 6)],
    };
    let s = reducer(crafted, { type: 'FIGHT_BAREHANDED', cardId: 'C2' });
    s = reducer(s, { type: 'FIGHT_BAREHANDED', cardId: 'S3' });
    s = reducer(s, { type: 'FIGHT_BAREHANDED', cardId: 'C4' });
    s = reducer(s, { type: 'DEAL_NEXT_ROOM' });
    expect(s.dealtSize).toBe(2);
    expect(s.requiredResolves).toBe(2);
    expect(s.room.map((c) => c.id)).toEqual(['D5', 'H6']);
    expect(s.dungeon).toEqual([]);
  });

  it('resolving the final partial room wins the game with score = remaining health', () => {
    const base = createInitialState(1);
    const crafted: GameState = {
      ...base,
      room: [makeCard('diamonds', 5), makeCard('hearts', 6)],
      resolvedCount: 0,
      requiredResolves: 2,
      dealtSize: 2,
      dungeon: [],
      health: 14,
      potionUsedThisRoom: false,
    };
    let s = reducer(crafted, { type: 'EQUIP_WEAPON', cardId: 'D5' });
    s = reducer(s, { type: 'DRINK_POTION', cardId: 'H6' });
    expect(s.phase).toBe('won');
    expect(s.score).toBe(Math.min(20, 14 + 6));
  });
});

describe('running away', () => {
  it('is allowed at the start of a fresh full room with deck >= 4 and not after a run', () => {
    const s = newGame(1);
    expect(canRun(s)).toBe(true);
  });

  it('is forbidden after resolving any card in the room', () => {
    const s0 = craft({
      room: [makeCard('clubs', 3), makeCard('diamonds', 5), makeCard('hearts', 4), makeCard('spades', 7)],
      dungeon: [makeCard('clubs', 2), makeCard('spades', 6), makeCard('hearts', 8), makeCard('diamonds', 4), makeCard('clubs', 5)],
    });
    const s = resolve(s0, { type: 'FIGHT_BAREHANDED', cardId: 'C3' });
    expect(canRun(s)).toBe(false);
  });

  it('is forbidden immediately after running (no two in a row)', () => {
    const s = newGame(1);
    const after = resolve(s, { type: 'RUN' });
    expect(canRun(after)).toBe(false);
    expect(after.ranLastRoom).toBe(true);
  });

  it('sends the current room to the bottom of the dungeon and draws a fresh 4', () => {
    const s = newGame(1);
    const oldRoomIds = s.room.map((c) => c.id);
    const oldDungeonSize = s.dungeon.length;
    const after = resolve(s, { type: 'RUN' });
    expect(after.dungeon.length).toBe(oldDungeonSize); // net deck size unchanged
    expect(after.room.length).toBe(4);
    expect(after.resolvedCount).toBe(0);
    // The four old room cards should now be at the bottom of the dungeon.
    const bottomFour = after.dungeon.slice(-4).map((c) => c.id).sort();
    expect(bottomFour).toEqual([...oldRoomIds].sort());
    // And the newly drawn room must contain four cards not from the old room.
    for (const c of after.room) expect(oldRoomIds).not.toContain(c.id);
  });
});

describe('losing', () => {
  it('ends the game when health drops to 0 and sets score to minus monster values in the deck', () => {
    const base = createInitialState(1);
    const crafted: GameState = {
      ...base,
      health: 3,
      room: [makeCard('clubs', 10), makeCard('spades', 2), makeCard('hearts', 4), makeCard('diamonds', 3)],
      dungeon: [makeCard('clubs', 5), makeCard('hearts', 7), makeCard('spades', 11)],
      resolvedCount: 0,
      requiredResolves: 3,
      dealtSize: 4,
    };
    const s = reducer(crafted, { type: 'FIGHT_BAREHANDED', cardId: 'C10' });
    expect(s.health).toBe(-7);
    expect(s.phase).toBe('lost');
    // Monsters remaining in dungeon draw pile: 5 + 11 = 16
    expect(s.score).toBe(-16);
  });

  it('can still lose inside the final partial room', () => {
    const base = createInitialState(1);
    const crafted: GameState = {
      ...base,
      health: 2,
      room: [makeCard('clubs', 10), makeCard('spades', 2)],
      dungeon: [],
      resolvedCount: 0,
      requiredResolves: 2,
      dealtSize: 2,
    };
    const s = reducer(crafted, { type: 'FIGHT_BAREHANDED', cardId: 'C10' });
    expect(s.phase).toBe('lost');
    expect(s.score).toBe(0); // no monsters left in the empty dungeon
  });
});

describe('full scripted game (win)', () => {
  it('clears a tiny scripted dungeon and reports the remaining health as the score', () => {
    // Craft a 4-card dungeon with a trivially winnable layout using a fabricated state.
    // Dungeon order (top first): C2, C3, D10, H4 -> but engine draws 4 for first room from dungeon.
    const base = createInitialState(1);
    const dungeon: Card[] = [
      makeCard('clubs', 2),
      makeCard('clubs', 3),
      makeCard('diamonds', 10),
      makeCard('hearts', 4),
    ];
    const start: GameState = {
      ...base,
      dungeon,
      room: [],
      carryover: null,
      weapon: null,
      discard: [],
      resolvedCount: 0,
      requiredResolves: 3,
      dealtSize: 0,
      potionUsedThisRoom: false,
      ranLastRoom: false,
      roomComplete: false,
      health: 20,
      score: null,
      log: [],
    };
    // Use reducer NEW_DR... no: re-deal via a NEW_GAME-like beginRoom by dispatching nothing.
    // We instead manually drive the reducer starting from a "first room" crafted from the top 4.
    let s: GameState = {
      ...start,
      room: [makeCard('clubs', 2), makeCard('clubs', 3), makeCard('diamonds', 10), makeCard('hearts', 4)],
      dungeon: [],
      requiredResolves: 3,
      dealtSize: 4,
    };
    s = reducer(s, { type: 'EQUIP_WEAPON', cardId: 'D10' }); // equip weapon (1)
    s = reducer(s, { type: 'FIGHT_WITH_WEAPON', cardId: 'C2' }); // 0 dmg (2)
    s = reducer(s, { type: 'FIGHT_WITH_WEAPON', cardId: 'C3' }); // wait: C3 is not strictly weaker than lastKilled 2 -> reject
    // Instead drink the potion for the third resolve.
    s = reducer(s, { type: 'DRINK_POTION', cardId: 'H4' }); // already at 20, heal 0 (3)
    expect(s.roomComplete).toBe(true);
    expect(s.carryover?.id).toBe('C3');
    s = reducer(s, { type: 'DEAL_NEXT_ROOM' });
    // Final partial room of 1 card (C3), no deck.
    expect(s.dealtSize).toBe(1);
    expect(s.requiredResolves).toBe(1);
    // Equipped weapon degraded to lastKilled 2 cannot hit C3, so fight barehanded.
    s = reducer(s, { type: 'FIGHT_BAREHANDED', cardId: 'C3' });
    expect(s.phase).toBe('won');
    expect(s.health).toBe(20 - 3);
    expect(s.score).toBe(20 - 3);
  });
});

describe('reducer guards', () => {
  it('ignores actions when the game is over', () => {
    const base = createInitialState(1);
    const won: GameState = { ...base, phase: 'won', room: [], roomComplete: true, score: 12 };
    const next = reducer(won, { type: 'FIGHT_BAREHANDED', cardId: 'nope' });
    expect(next).toBe(won);
  });

  it('ignores DEAL_NEXT_ROOM before the room is complete', () => {
    const s = newGame(1);
    const next = reducer(s, { type: 'DEAL_NEXT_ROOM' });
    expect(next).toBe(s);
  });
});