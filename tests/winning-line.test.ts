import { describe, expect, it } from 'vitest';
import {
  type Action,
  type GameState,
  applyAction,
  createGame,
  isLegal,
  score,
} from '../src/game/engine.js';
import { totalCards } from './helpers.js';

/**
 * A verified winning line for seed 1, found by searching the game tree.
 *
 * This is a golden test over the whole rule set: it exercises weapon
 * degradation across descending kill chains (s14 → c13 → c10 → c8 → c7 on a
 * single 9♦), weapon swaps, the one-potion-per-room limit and the carry-over
 * card, all in one sequence. Any change to a rule, to the deck, or to the
 * shuffle will break it — which is the point. If this fails after an
 * intentional rules change, re-derive the line rather than loosening the
 * assertions.
 */
const WINNING_LINE: readonly Action[] = [
  { type: 'equip', cardId: 'd6' },
  { type: 'equip', cardId: 'd8' },
  { type: 'drink', cardId: 'h4' },
  { type: 'fight', cardId: 'c11', withWeapon: true },
  { type: 'fight', cardId: 's10', withWeapon: true },
  { type: 'fight', cardId: 's6', withWeapon: true },
  { type: 'equip', cardId: 'd5' },
  { type: 'fight', cardId: 's13', withWeapon: true },
  { type: 'drink', cardId: 'h10' },
  { type: 'fight', cardId: 's3', withWeapon: false },
  { type: 'fight', cardId: 'c4', withWeapon: false },
  { type: 'drink', cardId: 'h8' },
  { type: 'fight', cardId: 's9', withWeapon: true },
  { type: 'drink', cardId: 'h3' },
  { type: 'fight', cardId: 's7', withWeapon: true },
  { type: 'fight', cardId: 'c5', withWeapon: true },
  { type: 'equip', cardId: 'd9' },
  { type: 'fight', cardId: 's14', withWeapon: true },
  { type: 'drink', cardId: 'h9' },
  { type: 'fight', cardId: 'c13', withWeapon: true },
  { type: 'fight', cardId: 'c10', withWeapon: true },
  { type: 'fight', cardId: 'c8', withWeapon: true },
  { type: 'fight', cardId: 'c7', withWeapon: true },
  { type: 'equip', cardId: 'd4' },
  { type: 'drink', cardId: 'h6' },
  { type: 'fight', cardId: 'c3', withWeapon: true },
  { type: 'fight', cardId: 's2', withWeapon: true },
  { type: 'equip', cardId: 'd7' },
  { type: 'fight', cardId: 'c9', withWeapon: true },
  { type: 'fight', cardId: 's8', withWeapon: true },
  { type: 'drink', cardId: 'h2' },
  { type: 'fight', cardId: 'c6', withWeapon: true },
  { type: 'fight', cardId: 's5', withWeapon: true },
  { type: 'fight', cardId: 's4', withWeapon: true },
  { type: 'equip', cardId: 'd2' },
  { type: 'equip', cardId: 'd10' },
  { type: 'fight', cardId: 'c14', withWeapon: true },
  { type: 'drink', cardId: 'h5' },
  { type: 'fight', cardId: 's12', withWeapon: true },
  { type: 'fight', cardId: 's11', withWeapon: true },
  { type: 'drink', cardId: 'h7' },
  { type: 'fight', cardId: 'c2', withWeapon: true },
  { type: 'equip', cardId: 'd3' },
  { type: 'fight', cardId: 'c12', withWeapon: false },
];

describe('a known winning line', () => {
  let final: GameState;

  it('is legal at every step and clears the dungeon', () => {
    let state = createGame(1);
    WINNING_LINE.forEach((action, i) => {
      expect(isLegal(state, action), `step ${i + 1}: ${JSON.stringify(action)}`).toBe(true);
      state = applyAction(state, action);
      expect(totalCards(state), `step ${i + 1} conserved the deck`).toBe(44);
    });
    final = state;

    expect(final.status).toBe('won');
    expect(final.dungeon).toHaveLength(0);
    expect(final.room).toHaveLength(0);
  });

  it('resolves all 44 cards across 15 rooms and scores 8', () => {
    expect(WINNING_LINE).toHaveLength(44);
    expect(final.roomNumber).toBe(15);
    expect(final.health).toBe(8);
    expect(score(final)).toBe(8);
  });

  it('drove a descending kill chain on a single weapon', () => {
    // Step 17 equips 9♦; steps 18-23 take s14, c13, c10, c8, c7 — strictly
    // descending, as weapon degradation requires.
    let state = createGame(1);
    for (const action of WINNING_LINE.slice(0, 23)) state = applyAction(state, action);
    expect(state.weapon?.card.id).toBe('d9');
    expect(state.weapon?.slain.map((c) => c.id)).toEqual(['s14', 'c13', 'c10', 'c8', 'c7']);

    const ranks = state.weapon!.slain.map((c) => c.rank);
    expect(ranks).toEqual([...ranks].sort((a, b) => b - a));
  });
});
