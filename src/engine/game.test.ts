import { describe, expect, it } from 'vitest';
import { buildDungeon, mulberry32, shuffle } from './deck';
import { createGame, gameReducer } from './game';
import {
  canWeaponFight,
  cardLabel,
  fightDamage,
  isMonster,
  isPotion,
  isWeapon,
  lossScore,
} from './rules';
import type { Card, GameAction, GameState, Suit } from './types';

/* ---------- helpers ---------- */

function mkCard(suit: Suit, rank: number): Card {
  const names: Record<number, string> = {
    11: 'jack',
    12: 'queen',
    13: 'king',
    14: 'ace',
  };
  const name = names[rank] ?? String(rank);
  return { suit, rank, value: rank, id: `${name}_of_${suit}` };
}

function mkState(partial: Partial<GameState>): GameState {
  return {
    deck: [],
    room: [],
    health: 20,
    weapon: null,
    discard: [],
    potionUsed: false,
    ranLastRoom: false,
    status: 'playing',
    score: null,
    log: [],
    seed: 1,
    ...partial,
  };
}

function allCards(state: GameState): Card[] {
  return [
    ...state.deck,
    ...state.room,
    ...state.discard,
    ...(state.weapon ? [state.weapon.card, ...state.weapon.kills] : []),
  ];
}

function legalActions(state: GameState): GameAction[] {
  const actions: GameAction[] = [];
  for (const card of state.room) {
    if (isPotion(card)) actions.push({ type: 'drink', cardId: card.id });
    else if (isWeapon(card)) actions.push({ type: 'equip', cardId: card.id });
    else {
      actions.push({ type: 'fight', cardId: card.id, useWeapon: false });
      if (state.weapon && canWeaponFight(state.weapon, card)) {
        actions.push({ type: 'fight', cardId: card.id, useWeapon: true });
      }
    }
  }
  if (!state.ranLastRoom && state.room.length === 4) {
    actions.push({ type: 'run' });
  }
  return actions;
}

/* ---------- deck ---------- */

describe('buildDungeon', () => {
  it('contains exactly 44 cards with unique ids', () => {
    const deck = buildDungeon();
    expect(deck).toHaveLength(44);
    expect(new Set(deck.map((c) => c.id)).size).toBe(44);
  });

  it('has all black cards and only red 2–10', () => {
    const deck = buildDungeon();
    expect(deck.filter((c) => c.suit === 'spades')).toHaveLength(13);
    expect(deck.filter((c) => c.suit === 'clubs')).toHaveLength(13);
    expect(deck.filter((c) => c.suit === 'diamonds')).toHaveLength(9);
    expect(deck.filter((c) => c.suit === 'hearts')).toHaveLength(9);
    for (const c of deck) {
      if (c.suit === 'diamonds' || c.suit === 'hearts') {
        expect(c.rank).toBeGreaterThanOrEqual(2);
        expect(c.rank).toBeLessThanOrEqual(10);
      }
    }
  });

  it('uses J=11 Q=12 K=13 A=14 values', () => {
    const deck = buildDungeon();
    expect(deck.find((c) => c.id === 'jack_of_spades')!.value).toBe(11);
    expect(deck.find((c) => c.id === 'queen_of_clubs')!.value).toBe(12);
    expect(deck.find((c) => c.id === 'king_of_spades')!.value).toBe(13);
    expect(deck.find((c) => c.id === 'ace_of_clubs')!.value).toBe(14);
  });
});

describe('shuffle', () => {
  it('is deterministic for a given seed', () => {
    const a = shuffle(buildDungeon(), mulberry32(42));
    const b = shuffle(buildDungeon(), mulberry32(42));
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
  });

  it('preserves the card multiset', () => {
    const deck = buildDungeon();
    const shuffled = shuffle(deck, mulberry32(7));
    expect([...shuffled].sort((a, b) => a.id.localeCompare(b.id))).toEqual(
      [...deck].sort((a, b) => a.id.localeCompare(b.id)),
    );
  });
});

/* ---------- setup / rooms ---------- */

describe('createGame', () => {
  it('deals a 4-card room, 40-card deck, 20 health', () => {
    const s = createGame(123);
    expect(s.room).toHaveLength(4);
    expect(s.deck).toHaveLength(40);
    expect(s.health).toBe(20);
    expect(s.status).toBe('playing');
    expect(allCards(s)).toHaveLength(44);
  });
});

describe('room resolution', () => {
  it('carries the 4th card over and refills to 4', () => {
    const carried = mkCard('spades', 2);
    const s = mkState({
      room: [mkCard('hearts', 3), mkCard('diamonds', 4), mkCard('clubs', 5), carried],
      deck: [mkCard('spades', 6), mkCard('clubs', 7), mkCard('hearts', 8), mkCard('diamonds', 9)],
    });
    let next = gameReducer(s, { type: 'drink', cardId: '3_of_hearts' });
    next = gameReducer(next, { type: 'equip', cardId: '4_of_diamonds' });
    next = gameReducer(next, { type: 'fight', cardId: '5_of_clubs', useWeapon: true });
    expect(next.room).toHaveLength(4);
    expect(next.room.some((c) => c.id === carried.id)).toBe(true);
    expect(next.deck).toHaveLength(1);
  });

  it('when the deck is empty the leave-one rule lapses; resolving everything wins', () => {
    const s = mkState({
      room: [mkCard('hearts', 5), mkCard('clubs', 2)],
      deck: [],
      health: 10,
    });
    let next = gameReducer(s, { type: 'drink', cardId: '5_of_hearts' });
    expect(next.status).toBe('playing');
    expect(next.room).toHaveLength(1); // no refill possible
    next = gameReducer(next, { type: 'fight', cardId: '2_of_clubs', useWeapon: false });
    expect(next.status).toBe('won');
    expect(next.score).toBe(next.health);
  });

  it('deals a partial room near the end of the deck', () => {
    const s = mkState({
      room: [mkCard('clubs', 3), mkCard('clubs', 4), mkCard('clubs', 5), mkCard('hearts', 2)],
      deck: [mkCard('spades', 9), mkCard('hearts', 9)],
    });
    let next = gameReducer(s, { type: 'drink', cardId: '2_of_hearts' });
    next = gameReducer(next, { type: 'fight', cardId: '3_of_clubs', useWeapon: false });
    next = gameReducer(next, { type: 'fight', cardId: '4_of_clubs', useWeapon: false });
    expect(next.room.map((c) => c.id).sort()).toEqual(
      ['5_of_clubs', '9_of_hearts', '9_of_spades'].sort(),
    );
    expect(next.deck).toHaveLength(0);
  });

  it('does not mutate the input state (reducer purity)', () => {
    const s = mkState({
      room: [mkCard('hearts', 3), mkCard('diamonds', 4), mkCard('clubs', 5), mkCard('spades', 6)],
      deck: [mkCard('spades', 7), mkCard('clubs', 8), mkCard('hearts', 9), mkCard('diamonds', 10)],
    });
    for (const action of [
      { type: 'drink', cardId: '3_of_hearts' },
      { type: 'equip', cardId: '4_of_diamonds' },
      { type: 'fight', cardId: '5_of_clubs', useWeapon: false },
      { type: 'run' },
    ] as GameAction[]) {
      const before = JSON.stringify(s);
      gameReducer(s, action);
      expect(JSON.stringify(s)).toBe(before);
    }
  });
});

/* ---------- potions ---------- */

describe('health potions', () => {
  it('heals up to the 20 cap', () => {
    const s = mkState({ room: [mkCard('hearts', 10)], health: 15 });
    const next = gameReducer(s, { type: 'drink', cardId: '10_of_hearts' });
    expect(next.health).toBe(20);
    expect(next.potionUsed).toBe(true);
  });

  it('allows only one potion per room; extras are discarded without healing', () => {
    const s = mkState({
      room: [mkCard('hearts', 4), mkCard('hearts', 6)],
      health: 10,
    });
    let next = gameReducer(s, { type: 'drink', cardId: '4_of_hearts' });
    expect(next.health).toBe(14);
    next = gameReducer(next, { type: 'drink', cardId: '6_of_hearts' });
    expect(next.health).toBe(14); // unchanged
    expect(next.discard.map((c) => c.id)).toContain('6_of_hearts');
  });

  it('resets the potion flag in the next room', () => {
    const s = mkState({
      room: [mkCard('hearts', 4), mkCard('clubs', 2), mkCard('clubs', 3), mkCard('spades', 3)],
      deck: [mkCard('hearts', 7), mkCard('clubs', 8), mkCard('spades', 9), mkCard('diamonds', 2)],
      health: 5,
    });
    let next = gameReducer(s, { type: 'drink', cardId: '4_of_hearts' });
    next = gameReducer(next, { type: 'fight', cardId: '2_of_clubs', useWeapon: false });
    next = gameReducer(next, { type: 'fight', cardId: '3_of_clubs', useWeapon: false });
    expect(next.potionUsed).toBe(false); // new room dealt
    next = gameReducer(next, { type: 'drink', cardId: '7_of_hearts' });
    expect(next.health).toBe(11); // 5 +4 (potion) −2 −3 (fights) +7 (new-room potion)
  });
});

/* ---------- weapons & combat ---------- */

describe('combat', () => {
  it('barehanded fight deals full damage and discards the monster', () => {
    const s = mkState({ room: [mkCard('spades', 13)], health: 20 });
    const next = gameReducer(s, { type: 'fight', cardId: 'king_of_spades', useWeapon: false });
    expect(next.health).toBe(7);
    expect(next.discard.map((c) => c.id)).toContain('king_of_spades');
  });

  it('weapon fight subtracts weapon value, floors at 0, stacks the kill', () => {
    const weapon = mkCard('diamonds', 9);
    const s = mkState({
      room: [mkCard('spades', 5), mkCard('clubs', 12)],
      weapon: { card: weapon, kills: [] },
      health: 20,
    });
    let next = gameReducer(s, { type: 'fight', cardId: '5_of_spades', useWeapon: true });
    expect(next.health).toBe(20);
    expect(next.weapon!.kills.map((c) => c.id)).toEqual(['5_of_spades']);
    expect(fightDamage(mkCard('clubs', 12), next.weapon!, true)).toBe(3);
  });

  it('equipping a new weapon discards the old one with its kills', () => {
    const s = mkState({
      room: [mkCard('diamonds', 8)],
      weapon: { card: mkCard('diamonds', 5), kills: [mkCard('clubs', 3)] },
    });
    const next = gameReducer(s, { type: 'equip', cardId: '8_of_diamonds' });
    expect(next.weapon!.card.id).toBe('8_of_diamonds');
    expect(next.weapon!.kills).toHaveLength(0);
    expect(next.discard.map((c) => c.id)).toEqual(
      expect.arrayContaining(['5_of_diamonds', '3_of_clubs']),
    );
  });

  it('degrades: only monsters strictly lower than the last kill are fightable', () => {
    const weapon = { card: mkCard('diamonds', 10), kills: [mkCard('spades', 7)] };
    expect(canWeaponFight(weapon, mkCard('clubs', 6))).toBe(true);
    expect(canWeaponFight(weapon, mkCard('clubs', 7))).toBe(false); // equal is not lower
    expect(canWeaponFight(weapon, mkCard('clubs', 9))).toBe(false);
    expect(canWeaponFight({ card: mkCard('diamonds', 2), kills: [] }, mkCard('spades', 14))).toBe(true);
  });

  it('reducer rejects an illegal weapon fight', () => {
    const s = mkState({
      room: [mkCard('spades', 9)],
      weapon: { card: mkCard('diamonds', 10), kills: [mkCard('clubs', 8)] },
    });
    const next = gameReducer(s, { type: 'fight', cardId: '9_of_spades', useWeapon: true });
    expect(next).toBe(s); // unchanged — must fight barehanded instead
    const bare = gameReducer(s, { type: 'fight', cardId: '9_of_spades', useWeapon: false });
    expect(bare.health).toBe(11);
  });

  it('a fresh weapon has no degradation restriction', () => {
    const s = mkState({
      room: [mkCard('spades', 14)],
      weapon: { card: mkCard('diamonds', 2), kills: [] },
      health: 20,
    });
    const next = gameReducer(s, { type: 'fight', cardId: 'ace_of_spades', useWeapon: true });
    expect(next.health).toBe(8); // 14 - 2
  });
});

/* ---------- running away ---------- */

describe('run away', () => {
  it('sends the room to the deck bottom and deals a new room', () => {
    const room = [mkCard('spades', 2), mkCard('clubs', 3), mkCard('hearts', 4), mkCard('diamonds', 5)];
    const deck = [mkCard('spades', 6), mkCard('clubs', 7), mkCard('hearts', 8), mkCard('diamonds', 9), mkCard('spades', 10)];
    const s = mkState({ room, deck });
    const next = gameReducer(s, { type: 'run' });
    expect(next.room.map((c) => c.id)).toEqual(
      ['6_of_spades', '7_of_clubs', '8_of_hearts', '9_of_diamonds'],
    );
    expect(next.deck.map((c) => c.id)).toEqual([
      '10_of_spades',
      ...room.map((c) => c.id),
    ]);
    expect(next.ranLastRoom).toBe(true);
  });

  it('forbids two runs in a row', () => {
    const s = mkState({
      room: [mkCard('spades', 2), mkCard('clubs', 3), mkCard('hearts', 4), mkCard('diamonds', 5)],
      deck: [mkCard('spades', 6), mkCard('clubs', 7), mkCard('hearts', 8), mkCard('diamonds', 9)],
      ranLastRoom: true,
    });
    expect(gameReducer(s, { type: 'run' })).toBe(s);
  });

  it('forbids running from a partially resolved room', () => {
    const s = mkState({ room: [mkCard('spades', 2), mkCard('clubs', 3)], deck: [] });
    expect(gameReducer(s, { type: 'run' })).toBe(s);
  });

  it('clears the run lock once a new room is reached by resolving cards', () => {
    const s = mkState({
      room: [mkCard('clubs', 2), mkCard('clubs', 3), mkCard('clubs', 4), mkCard('hearts', 5)],
      deck: [mkCard('spades', 6), mkCard('clubs', 7), mkCard('hearts', 8), mkCard('diamonds', 9)],
      ranLastRoom: true,
      health: 20,
    });
    let next = gameReducer(s, { type: 'fight', cardId: '2_of_clubs', useWeapon: false });
    next = gameReducer(next, { type: 'fight', cardId: '3_of_clubs', useWeapon: false });
    next = gameReducer(next, { type: 'fight', cardId: '4_of_clubs', useWeapon: false });
    expect(next.ranLastRoom).toBe(false);
  });
});

/* ---------- winning & losing ---------- */

describe('game over', () => {
  it('win score is remaining health', () => {
    const s = mkState({ room: [mkCard('hearts', 2)], deck: [], health: 17 });
    const next = gameReducer(s, { type: 'drink', cardId: '2_of_hearts' });
    expect(next.status).toBe('won');
    expect(next.score).toBe(19);
  });

  it('losing at 0 health scores 0 minus remaining deck monsters', () => {
    const s = mkState({
      room: [mkCard('spades', 13)],
      deck: [mkCard('clubs', 10), mkCard('hearts', 5), mkCard('spades', 4), mkCard('diamonds', 3)],
      health: 13,
    });
    const next = gameReducer(s, { type: 'fight', cardId: 'king_of_spades', useWeapon: false });
    expect(next.status).toBe('lost');
    expect(next.score).toBe(-14); // 10 (clubs) + 4 (spades); hearts/diamonds ignored
  });

  it('lossScore counts only monsters left in the draw pile', () => {
    const s = mkState({
      deck: [mkCard('clubs', 11), mkCard('diamonds', 10), mkCard('spades', 14)],
      room: [mkCard('spades', 2)], // unresolved room monsters not counted
    });
    expect(lossScore(s)).toBe(-25);
  });

  it('ignores further actions once the game is over', () => {
    const s = mkState({
      room: [mkCard('spades', 13)],
      deck: [],
      health: 5,
    });
    const dead = gameReducer(s, { type: 'fight', cardId: 'king_of_spades', useWeapon: false });
    expect(dead.status).toBe('lost');
    expect(gameReducer(dead, { type: 'run' })).toBe(dead);
  });
});

/* ---------- full-game simulation ---------- */

describe('full-game simulation', () => {
  it('random legal play always terminates with conserved cards and valid score', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const rng = mulberry32(seed * 1000 + 7);
      let state = createGame(seed);
      let steps = 0;
      while (state.status === 'playing') {
        expect(allCards(state)).toHaveLength(44);
        expect(new Set(allCards(state).map((c) => c.id)).size).toBe(44);
        expect(state.health).toBeLessThanOrEqual(20);
        const actions = legalActions(state);
        expect(actions.length).toBeGreaterThan(0);
        state = gameReducer(state, actions[Math.floor(rng() * actions.length)]);
        steps++;
        expect(steps).toBeLessThan(1000);
      }
      expect(allCards(state)).toHaveLength(44);
      if (state.status === 'won') {
        expect(state.score).toBe(state.health);
        expect(state.deck).toHaveLength(0);
        expect(state.room).toHaveLength(0);
      } else {
        const expected = -state.deck
          .filter(isMonster)
          .reduce((sum, c) => sum + c.value, 0);
        expect(state.score).toBe(expected);
        expect(state.health).toBeLessThanOrEqual(0);
      }
    }
  });
});

/* ---------- misc ---------- */

describe('cardLabel', () => {
  it('formats rank and suit', () => {
    expect(cardLabel(mkCard('spades', 14))).toBe('A♠');
    expect(cardLabel(mkCard('hearts', 10))).toBe('10♥');
    expect(cardLabel(mkCard('diamonds', 11))).toBe('J♦');
  });
});
