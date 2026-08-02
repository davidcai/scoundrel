import { describe, expect, it } from 'vitest';
import { isMonster, isPotion, isWeapon } from '../src/game/cards.js';
import {
  type Action,
  type GameState,
  IllegalActionError,
  MAX_HEALTH,
  applyAction,
  canAvoidRoom,
  createGame,
  isLegal,
  remainingMonsterValue,
  score,
  weaponCanFight,
} from '../src/game/engine.js';
import { card, cards, stateWith, totalCards } from './helpers.js';

describe('setup', () => {
  it('starts at 20 health with a room of 4 and 40 cards left', () => {
    const game = createGame(42);
    expect(game.health).toBe(MAX_HEALTH);
    expect(game.room).toHaveLength(4);
    expect(game.dungeon).toHaveLength(40);
    expect(game.status).toBe('playing');
    expect(game.roomNumber).toBe(1);
  });

  it('is deterministic for a given seed', () => {
    const ids = (g: GameState) => [...g.dungeon, ...g.room].map((c) => c.id);
    expect(ids(createGame(7))).toEqual(ids(createGame(7)));
    expect(ids(createGame(7))).not.toEqual(ids(createGame(8)));
  });
});

describe('fighting barehanded', () => {
  it('takes damage equal to the full value of the monster', () => {
    const state = stateWith({ room: cards('s14', 'c2', 'd5', 'h5') });
    const next = applyAction(state, { type: 'fight', cardId: 's14', withWeapon: false });
    expect(next.health).toBe(MAX_HEALTH - 14);
    expect(next.discard.map((c) => c.id)).toEqual(['s14']);
    expect(next.room.map((c) => c.id)).toEqual(['c2', 'd5', 'h5']);
  });
});

describe('fighting with a weapon', () => {
  it('takes only the difference as damage', () => {
    const state = stateWith({
      room: cards('s10', 'c2', 'd5', 'h5'),
      weapon: { card: card('d4'), slain: [] },
    });
    const next = applyAction(state, { type: 'fight', cardId: 's10', withWeapon: true });
    expect(next.health).toBe(MAX_HEALTH - 6);
  });

  it('never heals when the weapon outclasses the monster', () => {
    const state = stateWith({
      health: 12,
      room: cards('s3', 'c2', 'd5', 'h5'),
      weapon: { card: card('d10'), slain: [] },
    });
    const next = applyAction(state, { type: 'fight', cardId: 's3', withWeapon: true });
    expect(next.health).toBe(12);
  });

  it('stacks the slain monster on the weapon rather than the discard', () => {
    const state = stateWith({
      room: cards('s10', 'c2', 'd5', 'h5'),
      weapon: { card: card('d4'), slain: [] },
    });
    const next = applyAction(state, { type: 'fight', cardId: 's10', withWeapon: true });
    expect(next.weapon?.slain.map((c) => c.id)).toEqual(['s10']);
    expect(next.discard).toHaveLength(0);
  });
});

describe('weapon degradation', () => {
  it('lets a fresh weapon fight anything', () => {
    expect(weaponCanFight({ card: card('d2'), slain: [] }, card('s14'))).toBe(true);
  });

  it('only allows monsters strictly below the last kill', () => {
    const weapon = { card: card('d5'), slain: [card('s10')] };
    expect(weaponCanFight(weapon, card('c9'))).toBe(true);
    expect(weaponCanFight(weapon, card('c10'))).toBe(false);
    expect(weaponCanFight(weapon, card('c11'))).toBe(false);
  });

  it('tracks the most recent kill, not the largest', () => {
    const weapon = { card: card('d5'), slain: cards('s10', 's4') };
    expect(weaponCanFight(weapon, card('c3'))).toBe(true);
    expect(weaponCanFight(weapon, card('c9'))).toBe(false);
  });

  it('rejects a weapon attack that degradation forbids', () => {
    const state = stateWith({
      room: cards('s11', 'c2', 'd5', 'h5'),
      weapon: { card: card('d5'), slain: [card('s10')] },
    });
    const action: Action = { type: 'fight', cardId: 's11', withWeapon: true };
    expect(isLegal(state, action)).toBe(false);
    expect(() => applyAction(state, action)).toThrow(IllegalActionError);
  });

  it('still allows fighting that monster barehanded', () => {
    const state = stateWith({
      room: cards('s11', 'c2', 'd5', 'h5'),
      weapon: { card: card('d5'), slain: [card('s10')] },
    });
    const next = applyAction(state, { type: 'fight', cardId: 's11', withWeapon: false });
    expect(next.health).toBe(MAX_HEALTH - 11);
  });
});

describe('equipping weapons', () => {
  it('discards the old weapon and everything stacked on it', () => {
    const state = stateWith({
      room: cards('d9', 'c2', 's5', 'h5'),
      weapon: { card: card('d3'), slain: cards('s8', 's6') },
    });
    const next = applyAction(state, { type: 'equip', cardId: 'd9' });
    expect(next.weapon?.card.id).toBe('d9');
    expect(next.weapon?.slain).toEqual([]);
    expect(next.discard.map((c) => c.id).sort()).toEqual(['d3', 's6', 's8']);
  });
});

describe('health potions', () => {
  it('restores health equal to the card value', () => {
    const state = stateWith({ health: 10, room: cards('h7', 'c2', 's5', 'd5') });
    const next = applyAction(state, { type: 'drink', cardId: 'h7' });
    expect(next.health).toBe(17);
  });

  it('caps healing at 20', () => {
    const state = stateWith({ health: 18, room: cards('h9', 'c2', 's5', 'd5') });
    const next = applyAction(state, { type: 'drink', cardId: 'h9' });
    expect(next.health).toBe(MAX_HEALTH);
  });

  it('discards a second potion in the same room without healing', () => {
    const state = stateWith({ health: 5, room: cards('h7', 'h8', 's5', 'd5') });
    const afterFirst = applyAction(state, { type: 'drink', cardId: 'h7' });
    expect(afterFirst.health).toBe(12);

    const afterSecond = applyAction(afterFirst, { type: 'drink', cardId: 'h8' });
    expect(afterSecond.health).toBe(12);
    expect(afterSecond.discard.map((c) => c.id)).toEqual(['h7', 'h8']);
  });

  it('refreshes the potion allowance when a new room is dealt', () => {
    const state = stateWith({
      health: 5,
      room: cards('h7', 's2', 's3', 'h8'),
      dungeon: cards('c4', 'c5', 'c6', 'c7'),
    });
    let next = applyAction(state, { type: 'drink', cardId: 'h7' });
    next = applyAction(next, { type: 'fight', cardId: 's2', withWeapon: false });
    next = applyAction(next, { type: 'fight', cardId: 's3', withWeapon: false });

    // Third resolution deals a fresh room, so h8 carries over drinkable.
    expect(next.roomNumber).toBe(2);
    expect(next.potionUsedThisRoom).toBe(false);
    const healed = applyAction(next, { type: 'drink', cardId: 'h8' });
    expect(healed.health).toBe(next.health + 8);
  });
});

describe('room flow', () => {
  it('deals a new room after three cards are resolved, carrying the fourth', () => {
    const state = stateWith({
      room: cards('s2', 's3', 's4', 'd5'),
      dungeon: cards('c6', 'c7', 'c8', 'c9', 'c10'),
    });
    let next = state;
    for (const id of ['s2', 's3', 's4']) {
      next = applyAction(next, { type: 'fight', cardId: id, withWeapon: false });
    }
    expect(next.roomNumber).toBe(2);
    expect(next.room.map((c) => c.id)).toEqual(['d5', 'c6', 'c7', 'c8']);
    expect(next.dungeon.map((c) => c.id)).toEqual(['c9', 'c10']);
  });

  it('does not deal past an empty dungeon', () => {
    const state = stateWith({ room: cards('h2', 'h3'), dungeon: [] });
    const next = applyAction(state, { type: 'drink', cardId: 'h2' });
    expect(next.room.map((c) => c.id)).toEqual(['h3']);
    expect(next.status).toBe('playing');
  });
});

describe('running away', () => {
  it('sends all four cards to the bottom and deals a fresh room', () => {
    const state = stateWith({
      room: cards('s14', 's13', 's12', 's11'),
      dungeon: cards('h2', 'h3', 'h4', 'h5', 'd6'),
    });
    const next = applyAction(state, { type: 'avoid' });
    expect(next.room.map((c) => c.id)).toEqual(['h2', 'h3', 'h4', 'h5']);
    expect(next.dungeon.map((c) => c.id)).toEqual(['d6', 's14', 's13', 's12', 's11']);
    expect(next.health).toBe(MAX_HEALTH);
  });

  it('cannot run from two rooms in a row', () => {
    const state = stateWith({
      room: cards('s14', 's13', 's12', 's11'),
      dungeon: cards('h2', 'h3', 'h4', 'h5', 'd6'),
    });
    const fled = applyAction(state, { type: 'avoid' });
    expect(canAvoidRoom(fled)).toBe(false);
    expect(() => applyAction(fled, { type: 'avoid' })).toThrow(IllegalActionError);
  });

  it('allows running again once a room has been faced', () => {
    const state = stateWith({
      room: cards('h2', 'h3', 'h4', 'h5'),
      dungeon: cards('d6', 'd7', 'd8', 'd9', 'd10', 's2'),
      avoidedLastRoom: true,
    });
    let next = state;
    for (const id of ['h2', 'h3', 'h4']) {
      next = applyAction(next, { type: 'drink', cardId: id });
    }
    expect(next.avoidedLastRoom).toBe(false);
    expect(canAvoidRoom(next)).toBe(true);
  });

  it('cannot run once a card in the room has been resolved', () => {
    const state = stateWith({
      room: cards('h2', 's13', 's12', 's11'),
      dungeon: cards('d6', 'd7', 'd8', 'd9'),
    });
    const next = applyAction(state, { type: 'drink', cardId: 'h2' });
    expect(next.room).toHaveLength(3);
    expect(canAvoidRoom(next)).toBe(false);
  });

  it('cannot run when the dungeon has no cards left to deal', () => {
    const state = stateWith({ room: cards('s14', 's13', 's12', 's11'), dungeon: [] });
    expect(canAvoidRoom(state)).toBe(false);
  });
});

describe('losing', () => {
  it('ends the game when health reaches 0', () => {
    const state = stateWith({ health: 4, room: cards('s14', 'c2', 'd5', 'h5') });
    const next = applyAction(state, { type: 'fight', cardId: 's14', withWeapon: false });
    expect(next.status).toBe('lost');
    expect(next.health).toBe(0);
  });

  it('scores the negative sum of every unplayed monster', () => {
    const state = stateWith({
      health: 2,
      room: cards('s5', 'c9', 'd5', 'h5'),
      dungeon: cards('c10', 'h2', 's3'),
    });
    const next = applyAction(state, { type: 'fight', cardId: 's5', withWeapon: false });
    expect(next.status).toBe('lost');
    // Unplayed monsters: c9 in the room, plus c10 and s3 in the dungeon.
    expect(remainingMonsterValue(next)).toBe(9 + 10 + 3);
    expect(score(next)).toBe(-22);
  });

  it('accepts no further actions once lost', () => {
    const state = stateWith({ health: 1, room: cards('s14', 'c2', 'd5', 'h5') });
    const next = applyAction(state, { type: 'fight', cardId: 's14', withWeapon: false });
    expect(isLegal(next, { type: 'drink', cardId: 'h5' })).toBe(false);
  });
});

describe('winning', () => {
  it('wins when the last card is resolved and the dungeon is empty', () => {
    const state = stateWith({ health: 14, room: cards('h3'), dungeon: [] });
    const next = applyAction(state, { type: 'drink', cardId: 'h3' });
    expect(next.status).toBe('won');
    expect(next.health).toBe(17);
    expect(score(next)).toBe(17);
  });

  it('caps a winning score at 20', () => {
    const state = stateWith({ health: MAX_HEALTH, room: cards('h9'), dungeon: [] });
    const next = applyAction(state, { type: 'drink', cardId: 'h9' });
    expect(score(next)).toBe(MAX_HEALTH);
  });
});

describe('full playthroughs', () => {
  /** Plays greedily: heal, arm up, then fight with the best option available. */
  function autoPlay(seed: number): GameState {
    let state = createGame(seed);
    for (let guard = 0; guard < 500 && state.status === 'playing'; guard++) {
      expect(totalCards(state)).toBe(44);

      const potion = state.room.find((c) => isPotion(c));
      const weapon = state.room.find((c) => isWeapon(c));
      const monsters = state.room.filter(isMonster).sort((a, b) => a.rank - b.rank);

      if (potion && !state.potionUsedThisRoom) {
        state = applyAction(state, { type: 'drink', cardId: potion.id });
      } else if (weapon && !state.weapon) {
        state = applyAction(state, { type: 'equip', cardId: weapon.id });
      } else if (monsters.length > 0) {
        const target = monsters[0]!;
        const withWeapon = weaponCanFight(state.weapon, target);
        state = applyAction(state, { type: 'fight', cardId: target.id, withWeapon });
      } else {
        const any = state.room[0]!;
        const action: Action = isPotion(any)
          ? { type: 'drink', cardId: any.id }
          : { type: 'equip', cardId: any.id };
        state = applyAction(state, action);
      }
    }
    return state;
  }

  it('always terminates with a conserved 44-card deck', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const final = autoPlay(seed);
      expect(final.status, `seed ${seed}`).not.toBe('playing');
      expect(totalCards(final), `seed ${seed}`).toBe(44);
      expect(final.health).toBeGreaterThanOrEqual(0);
      expect(final.health).toBeLessThanOrEqual(MAX_HEALTH);
    }
  });

  it('scores wins positively and losses negatively', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const final = autoPlay(seed);
      if (final.status === 'won') {
        expect(score(final)).toBe(final.health);
        expect(final.dungeon).toHaveLength(0);
        expect(final.room).toHaveLength(0);
      } else {
        expect(score(final)).toBeLessThanOrEqual(0);
      }
    }
  });
});
