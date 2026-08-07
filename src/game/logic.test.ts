import { describe, it, expect } from 'vitest';
import {
  createDeck,
  createShuffledDeck,
  shuffle,
  rankToLabel,
  suitToSymbol,
  suitIsRed,
  getCardType,
  canWeaponFightMonster,
  resolveCombat,
  calculateHeal,
  calculateWinScore,
  calculateLoseScore,
  getRemainingMonstersFromDeck,
  cardsNeededToResolve,
  MAX_HEALTH,
} from './logic';
import type { Card, Rank, Suit } from './types';

function makeCard(suit: Suit, rank: Rank): Card {
  return { id: `${suit}-${rank}`, suit, rank };
}

describe('createDeck', () => {
  it('creates 44 cards (52 minus jokers, red face cards, red aces)', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(44);
  });

  it('removes all red face cards (J, Q, K of hearts and diamonds)', () => {
    const deck = createDeck();
    const redFaces = deck.filter(
      (c) =>
        suitIsRed(c.suit) &&
        (c.rank === 11 || c.rank === 12 || c.rank === 13 || c.rank === 14),
    );
    expect(redFaces).toHaveLength(0);
  });

  it('keeps all clubs and spades including face cards', () => {
    const deck = createDeck();
    const blackCards = deck.filter(
      (c) => c.suit === 'clubs' || c.suit === 'spades',
    );
    expect(blackCards).toHaveLength(26);
  });

  it('keeps red number cards (2-10)', () => {
    const deck = createDeck();
    const redNumbers = deck.filter(
      (c) => suitIsRed(c.suit) && c.rank >= 2 && c.rank <= 10,
    );
    expect(redNumbers).toHaveLength(18);
  });

  it('has no duplicate card IDs', () => {
    const deck = createDeck();
    const ids = deck.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('createShuffledDeck', () => {
  it('has the same cards as createDeck but shuffled', () => {
    const ordered = createDeck();
    const shuffledDeck = createShuffledDeck();
    expect(shuffledDeck).toHaveLength(ordered.length);
    expect(new Set(shuffledDeck.map((c) => c.id))).toEqual(
      new Set(ordered.map((c) => c.id)),
    );
  });
});

describe('shuffle', () => {
  it('does not mutate the original array', () => {
    const original = [1, 2, 3, 4, 5];
    const result = shuffle(original);
    expect(original).toEqual([1, 2, 3, 4, 5]);
    expect(result).not.toBe(original);
  });

  it('preserves elements', () => {
    const original = [1, 2, 3, 4, 5];
    const result = shuffle(original);
    expect(result.sort()).toEqual(original);
  });
});

describe('rankToLabel', () => {
  it('labels number cards', () => {
    expect(rankToLabel(2)).toBe('2');
    expect(rankToLabel(10)).toBe('10');
  });

  it('labels face cards', () => {
    expect(rankToLabel(11)).toBe('J');
    expect(rankToLabel(12)).toBe('Q');
    expect(rankToLabel(13)).toBe('K');
    expect(rankToLabel(14)).toBe('A');
  });
});

describe('suitToSymbol', () => {
  it('returns correct symbols', () => {
    expect(suitToSymbol('hearts')).toBe('♥');
    expect(suitToSymbol('diamonds')).toBe('♦');
    expect(suitToSymbol('clubs')).toBe('♣');
    expect(suitToSymbol('spades')).toBe('♠');
  });
});

describe('suitIsRed', () => {
  it('returns true for hearts and diamonds', () => {
    expect(suitIsRed('hearts')).toBe(true);
    expect(suitIsRed('diamonds')).toBe(true);
  });

  it('returns false for clubs and spades', () => {
    expect(suitIsRed('clubs')).toBe(false);
    expect(suitIsRed('spades')).toBe(false);
  });
});

describe('getCardType', () => {
  it('classifies clubs and spades as monsters', () => {
    expect(getCardType(makeCard('clubs', 7))).toBe('monster');
    expect(getCardType(makeCard('spades', 13))).toBe('monster');
  });

  it('classifies diamonds as weapons', () => {
    expect(getCardType(makeCard('diamonds', 5))).toBe('weapon');
  });

  it('classifies hearts as potions', () => {
    expect(getCardType(makeCard('hearts', 8))).toBe('potion');
  });
});

describe('canWeaponFightMonster', () => {
  it('allows fighting when no monster has been killed yet', () => {
    expect(canWeaponFightMonster(null, 10)).toBe(true);
  });

  it('allows fighting weaker monsters', () => {
    expect(canWeaponFightMonster(10, 7)).toBe(true);
    expect(canWeaponFightMonster(10, 9)).toBe(true);
  });

  it('disallows fighting equal or stronger monsters', () => {
    expect(canWeaponFightMonster(10, 10)).toBe(false);
    expect(canWeaponFightMonster(10, 13)).toBe(false);
  });
});

describe('resolveCombat', () => {
  it('fights barehanded when no weapon', () => {
    const monster = makeCard('clubs', 8);
    const result = resolveCombat(monster, null);
    expect(result.damage).toBe(8);
    expect(result.usedWeapon).toBe(false);
    expect(result.monsterDefeated).toBe(true);
  });

  it('reduces damage with weapon', () => {
    const monster = makeCard('spades', 10);
    const weapon = { card: makeCard('diamonds', 6), lastKilledValue: null };
    const result = resolveCombat(monster, weapon);
    expect(result.damage).toBe(4);
    expect(result.usedWeapon).toBe(true);
  });

  it('deals zero damage when weapon is stronger', () => {
    const monster = makeCard('spades', 3);
    const weapon = { card: makeCard('diamonds', 10), lastKilledValue: null };
    const result = resolveCombat(monster, weapon);
    expect(result.damage).toBe(0);
    expect(result.usedWeapon).toBe(true);
  });

  it('fights barehanded when weapon is degraded and monster too strong', () => {
    const monster = makeCard('clubs', 12);
    const weapon = {
      card: makeCard('diamonds', 5),
      lastKilledValue: 8 as Rank,
    };
    const result = resolveCombat(monster, weapon);
    expect(result.damage).toBe(12);
    expect(result.usedWeapon).toBe(false);
  });

  it('uses weapon for weaker monster after degradation', () => {
    const monster = makeCard('clubs', 5);
    const weapon = {
      card: makeCard('diamonds', 3),
      lastKilledValue: 8 as Rank,
    };
    const result = resolveCombat(monster, weapon);
    expect(result.damage).toBe(2);
    expect(result.usedWeapon).toBe(true);
  });
});

describe('calculateHeal', () => {
  it('heals by potion value', () => {
    const potion = makeCard('hearts', 8);
    expect(calculateHeal(potion, 10)).toBe(8);
  });

  it('caps at max health', () => {
    const potion = makeCard('hearts', 10);
    expect(calculateHeal(potion, 18)).toBe(2);
  });

  it('does not overheal when at max', () => {
    const potion = makeCard('hearts', 5);
    expect(calculateHeal(potion, MAX_HEALTH)).toBe(0);
  });
});

describe('calculateWinScore', () => {
  it('returns health when below max', () => {
    expect(calculateWinScore(15)).toBe(15);
  });

  it('caps at max health', () => {
    expect(calculateWinScore(MAX_HEALTH)).toBe(MAX_HEALTH);
  });
});

describe('calculateLoseScore', () => {
  it('returns negative sum of remaining monster values', () => {
    const monsters = [
      makeCard('clubs', 7),
      makeCard('spades', 10),
      makeCard('clubs', 13),
    ];
    expect(calculateLoseScore(monsters)).toBe(-30);
  });

  it('returns 0 when no monsters remain', () => {
    expect(calculateLoseScore([])).toBe(0);
  });
});

describe('getRemainingMonstersFromDeck', () => {
  it('filters only monster cards from deck', () => {
    const deck = [
      makeCard('clubs', 7),
      makeCard('hearts', 5),
      makeCard('spades', 10),
      makeCard('diamonds', 3),
    ];
    const monsters = getRemainingMonstersFromDeck(deck);
    expect(monsters).toHaveLength(2);
    expect(monsters.every((c) => getCardType(c) === 'monster')).toBe(true);
  });
});

describe('cardsNeededToResolve', () => {
  it('returns 3 for a full room of 4', () => {
    expect(cardsNeededToResolve(4)).toBe(3);
  });

  it('returns roomSize - 1 for smaller rooms', () => {
    expect(cardsNeededToResolve(3)).toBe(2);
    expect(cardsNeededToResolve(2)).toBe(1);
  });

  it('returns 0 for a single card (auto-discarded)', () => {
    expect(cardsNeededToResolve(1)).toBe(0);
  });

  it('returns 0 for empty room', () => {
    expect(cardsNeededToResolve(0)).toBe(0);
  });
});
