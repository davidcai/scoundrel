import { describe, expect, it } from 'vitest';
import {
  MAX_HEALTH,
  canRun,
  canUseWeaponOn,
  cardKind,
  createDeck,
  drinkPotion,
  equipWeapon,
  fightMonster,
  newGame,
  runAway,
  weaponKillCap,
  type Card,
  type GameState,
} from './game';

const card = (suit: Card['suit'], rank: number): Card => ({ suit, rank });

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    deck: [],
    room: [],
    discard: [],
    health: MAX_HEALTH,
    weapon: null,
    potionUsedThisRoom: false,
    resolvedThisRoom: 0,
    ranFromLastRoom: false,
    status: 'playing',
    score: 0,
    ...overrides,
  };
}

describe('deck construction', () => {
  it('has 44 cards with red faces and red aces removed', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(44);
    const bySuit = (suit: Card['suit']) => deck.filter((c) => c.suit === suit);
    expect(bySuit('clubs')).toHaveLength(13);
    expect(bySuit('spades')).toHaveLength(13);
    expect(bySuit('diamonds')).toHaveLength(9);
    expect(bySuit('hearts')).toHaveLength(9);
    for (const c of [...bySuit('diamonds'), ...bySuit('hearts')]) {
      expect(c.rank).toBeGreaterThanOrEqual(2);
      expect(c.rank).toBeLessThanOrEqual(10);
    }
    const ranks = bySuit('spades').map((c) => c.rank).sort((a, b) => a - b);
    expect(ranks).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
  });

  it('maps suits to card kinds', () => {
    expect(cardKind(card('clubs', 5))).toBe('monster');
    expect(cardKind(card('spades', 14))).toBe('monster');
    expect(cardKind(card('diamonds', 7))).toBe('weapon');
    expect(cardKind(card('hearts', 3))).toBe('potion');
  });
});

describe('new game', () => {
  it('starts at 20 health with a room of 4 and 40 cards left in the deck', () => {
    const state = newGame(1);
    expect(state.health).toBe(20);
    expect(state.room).toHaveLength(4);
    expect(state.deck).toHaveLength(40);
    expect(state.status).toBe('playing');
  });

  it('is deterministic for a given seed', () => {
    expect(newGame(42)).toEqual(newGame(42));
    expect(newGame(1).deck).not.toEqual(newGame(2).deck);
  });
});

describe('combat', () => {
  it('barehanded fights take the full monster value as damage', () => {
    const state = makeState({ room: [card('spades', 10), card('clubs', 2)] });
    fightMonster(state, 0, false);
    expect(state.health).toBe(10);
    expect(state.room).toHaveLength(1);
    expect(state.discard).toEqual([card('spades', 10)]);
  });

  it('a weapon absorbs its value and stacks the slain monster', () => {
    const state = makeState({
      weapon: { card: card('diamonds', 5), kills: [] },
      room: [card('clubs', 8), card('clubs', 2)],
    });
    fightMonster(state, 0, true);
    expect(state.health).toBe(17);
    expect(state.weapon?.kills).toEqual([card('clubs', 8)]);
  });

  it('a weapon stronger than the monster prevents all damage but still degrades', () => {
    const state = makeState({
      weapon: { card: card('diamonds', 9), kills: [] },
      room: [card('spades', 4), card('clubs', 2)],
    });
    fightMonster(state, 0, true);
    expect(state.health).toBe(20);
    expect(weaponKillCap(state.weapon!)).toBe(4);
  });

  it('a degraded weapon only strikes strictly weaker monsters', () => {
    const state = makeState({
      weapon: { card: card('diamonds', 5), kills: [card('clubs', 8)] },
    });
    expect(canUseWeaponOn(state, card('spades', 7))).toBe(true);
    expect(canUseWeaponOn(state, card('spades', 8))).toBe(false);
    expect(canUseWeaponOn(state, card('spades', 9))).toBe(false);
  });

  it('rejects weapon strikes forbidden by degradation without consuming the card', () => {
    const state = makeState({
      weapon: { card: card('diamonds', 5), kills: [card('clubs', 6)] },
      room: [card('spades', 9), card('clubs', 2)],
    });
    expect(() => fightMonster(state, 0, true)).toThrow();
    expect(state.room).toHaveLength(2);
    expect(state.health).toBe(20);
  });

  it('allows fighting barehanded even while holding a usable weapon', () => {
    const state = makeState({
      weapon: { card: card('diamonds', 9), kills: [] },
      room: [card('spades', 4), card('clubs', 2)],
    });
    fightMonster(state, 0, false);
    expect(state.health).toBe(16);
    expect(state.weapon?.kills).toEqual([]);
  });
});

describe('weapons', () => {
  it('equipping a new weapon discards the old one and its kill stack', () => {
    const state = makeState({
      weapon: { card: card('diamonds', 3), kills: [card('clubs', 5)] },
      room: [card('diamonds', 8), card('clubs', 2)],
    });
    equipWeapon(state, 0);
    expect(state.weapon).toEqual({ card: card('diamonds', 8), kills: [] });
    expect(state.discard).toEqual(expect.arrayContaining([card('diamonds', 3), card('clubs', 5)]));
  });
});

describe('potions', () => {
  it('heals up to the 20-health cap', () => {
    const state = makeState({ health: 18, room: [card('hearts', 9), card('clubs', 2)] });
    drinkPotion(state, 0);
    expect(state.health).toBe(20);
  });

  it('only the first potion per room heals; extras are discarded', () => {
    const state = makeState({
      health: 5,
      room: [card('hearts', 4), card('hearts', 6), card('clubs', 2)],
    });
    drinkPotion(state, 0);
    expect(state.health).toBe(9);
    drinkPotion(state, 0);
    expect(state.health).toBe(9);
    expect(state.discard).toHaveLength(2);
  });

  it('the potion allowance resets when the next room is dealt', () => {
    const state = makeState({
      health: 5,
      potionUsedThisRoom: true,
      room: [card('hearts', 4), card('clubs', 2)],
      deck: [card('clubs', 3), card('clubs', 4), card('clubs', 5)],
    });
    drinkPotion(state, 0);
    expect(state.health).toBe(5);
    expect(state.potionUsedThisRoom).toBe(false);
    expect(state.room).toHaveLength(4);
  });
});

describe('rooms', () => {
  it('after resolving 3 of 4, the last card carries into a fresh room of 4', () => {
    const carried = card('spades', 2);
    const state = makeState({
      room: [card('clubs', 2), card('clubs', 3), card('clubs', 4), carried],
      deck: [card('hearts', 2), card('hearts', 3), card('hearts', 4), card('hearts', 5)],
    });
    fightMonster(state, 0, false);
    fightMonster(state, 0, false);
    expect(state.room).toHaveLength(2);
    fightMonster(state, 0, false);
    expect(state.room).toHaveLength(4);
    expect(state.room[0]).toEqual(carried);
    expect(state.deck).toHaveLength(1);
    expect(state.resolvedThisRoom).toBe(0);
  });
});

describe('running away', () => {
  it('buries the room at the bottom of the deck and deals a new one', () => {
    const roomCards = [card('clubs', 2), card('clubs', 3), card('clubs', 4), card('clubs', 5)];
    const deckCards = [
      card('hearts', 2),
      card('hearts', 3),
      card('hearts', 4),
      card('hearts', 5),
      card('hearts', 6),
    ];
    const state = makeState({ room: [...roomCards], deck: [...deckCards] });
    runAway(state);
    expect(state.room).toEqual(deckCards.slice(0, 4));
    expect(state.deck).toEqual([deckCards[4], ...roomCards]);
    expect(state.ranFromLastRoom).toBe(true);
    expect(canRun(state)).toBe(false);
    expect(() => runAway(state)).toThrow();
  });

  it('cannot run after resolving a card in the room', () => {
    const state = makeState({
      room: [card('clubs', 2), card('clubs', 3)],
      resolvedThisRoom: 1,
    });
    expect(canRun(state)).toBe(false);
    expect(() => runAway(state)).toThrow();
  });

  it('the run allowance returns after facing the next room', () => {
    const state = makeState({
      room: [card('clubs', 2), card('clubs', 3), card('clubs', 4), card('clubs', 5)],
      deck: [
        card('hearts', 2),
        card('hearts', 3),
        card('hearts', 4),
        card('hearts', 5),
        card('hearts', 6),
      ],
    });
    runAway(state);
    expect(canRun(state)).toBe(false);
    drinkPotion(state, 0);
    drinkPotion(state, 0);
    drinkPotion(state, 0);
    expect(state.resolvedThisRoom).toBe(0); // next room was dealt
    expect(canRun(state)).toBe(true);
  });
});

describe('winning and losing', () => {
  it('resolving the last card of an emptied deck wins with health as the score', () => {
    const state = makeState({ health: 13, room: [card('hearts', 2)], potionUsedThisRoom: true });
    drinkPotion(state, 0);
    expect(state.status).toBe('won');
    expect(state.score).toBe(13);
  });

  it('death scores 0 minus the monsters left in the dungeon deck', () => {
    const state = makeState({
      health: 5,
      room: [card('spades', 9), card('clubs', 2)],
      deck: [card('clubs', 10), card('hearts', 5), card('spades', 14), card('diamonds', 8)],
    });
    fightMonster(state, 0, false);
    expect(state.status).toBe('lost');
    expect(state.health).toBe(0);
    expect(state.score).toBe(-24);
  });

  it('rejects further actions once the game is over', () => {
    const state = makeState({ status: 'lost', room: [card('clubs', 2)] });
    expect(() => fightMonster(state, 0, false)).toThrow();
  });
});

describe('full playthrough', () => {
  it('a simple bot always reaches an end state with all 44 cards accounted for', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const state = newGame(seed);
      let guard = 500;
      while (state.status === 'playing' && guard-- > 0) {
        const target = state.room[0]!;
        switch (cardKind(target)) {
          case 'monster':
            fightMonster(state, 0, canUseWeaponOn(state, target));
            break;
          case 'weapon':
            equipWeapon(state, 0);
            break;
          case 'potion':
            drinkPotion(state, 0);
            break;
        }
        const total =
          state.deck.length +
          state.room.length +
          state.discard.length +
          (state.weapon ? 1 + state.weapon.kills.length : 0);
        expect(total).toBe(44);
        expect(state.health).toBeGreaterThanOrEqual(0);
        expect(state.health).toBeLessThanOrEqual(MAX_HEALTH);
      }
      expect(guard).toBeGreaterThan(0);
      expect(['won', 'lost']).toContain(state.status);
      if (state.status === 'won') expect(state.score).toBe(state.health);
      if (state.status === 'lost') expect(state.score).toBeLessThanOrEqual(0);
    }
  });
});
