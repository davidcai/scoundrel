import { describe, expect, it } from 'vitest';
import { buildDungeon, makeCard, shuffle } from '../src/game/deck';
import { mulberry32 } from '../src/game/rng';
import { cardKind } from '../src/game/rules';

describe('buildDungeon', () => {
  it('produces exactly 44 cards', () => {
    expect(buildDungeon().length).toBe(44);
  });

  it('includes clubs and spades 2..14 (26 monsters)', () => {
    const d = buildDungeon();
    const monsters = d.filter((c) => c.suit === 'clubs' || c.suit === 'spades');
    expect(monsters.length).toBe(26);
    for (const s of ['clubs', 'spades'] as const) {
      const ranks = d.filter((c) => c.suit === s).map((c) => c.rank).sort((a, b) => a - b);
      expect(ranks).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    }
  });

  it('includes diamonds and hearts 2..10 only (9 each = 18)', () => {
    const d = buildDungeon();
    expect(d.filter((c) => c.suit === 'diamonds').length).toBe(9);
    expect(d.filter((c) => c.suit === 'hearts').length).toBe(9);
    for (const s of ['diamonds', 'hearts'] as const) {
      const ranks = d.filter((c) => c.suit === s).map((c) => c.rank).sort((a, b) => a - b);
      expect(ranks).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
    }
  });

  it('never includes red face cards or red aces', () => {
    const d = buildDungeon();
    const redFaceOrAce = d.filter(
      (c) =>
        (c.suit === 'hearts' || c.suit === 'diamonds') &&
        (c.rank === 11 || c.rank === 12 || c.rank === 13 || c.rank === 14),
    );
    expect(redFaceOrAce.length).toBe(0);
  });

  it('assigns each card a unique id with value equal to rank', () => {
    const d = buildDungeon();
    const ids = new Set(d.map((c) => c.id));
    expect(ids.size).toBe(44);
    for (const c of d) expect(c.value).toBe(c.rank);
  });

  it('classifies suits into kinds correctly', () => {
    expect(cardKind(makeCard('clubs', 2))).toBe('monster');
    expect(cardKind(makeCard('spades', 14))).toBe('monster');
    expect(cardKind(makeCard('diamonds', 5))).toBe('weapon');
    expect(cardKind(makeCard('hearts', 7))).toBe('potion');
  });
});

describe('shuffle', () => {
  it('preserves the multiset of cards', () => {
    const d = buildDungeon();
    const shuffled = shuffle(d, mulberry32(1));
    expect(shuffled.sort((a, b) => a.id.localeCompare(b.id))).toEqual(
      d.sort((a, b) => a.id.localeCompare(b.id)),
    );
  });

  it('is deterministic for a fixed seed', () => {
    const a = shuffle(buildDungeon(), mulberry32(42));
    const b = shuffle(buildDungeon(), mulberry32(42));
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
  });

  it('changes order for most seeds compared to the unshuffled deck', () => {
    const d = buildDungeon();
    const shuffled = shuffle(d, mulberry32(7));
    let changes = 0;
    for (let i = 0; i < d.length; i++) if (d[i].id !== shuffled[i].id) changes++;
    expect(changes).toBeGreaterThan(40);
  });
});