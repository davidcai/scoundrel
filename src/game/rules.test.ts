import { describe, expect, it } from 'vitest';
import { buildDeck, labelFor } from './deck';
import {
  canUseWeapon,
  cardKind,
  drinkPotion,
  equipWeapon,
  fightMonster,
  runAway,
  startGame,
} from './rules';
import type { Card } from './types';

function card(suit: Card['suit'], value: number): Card {
  return { id: `${suit}-${value}`, suit, value };
}

describe('deck', () => {
  it('contains 44 cards: all black cards, red 2-10 only', () => {
    const deck = buildDeck();
    expect(deck).toHaveLength(44);
    expect(deck.filter((c) => c.suit === 'clubs')).toHaveLength(13);
    expect(deck.filter((c) => c.suit === 'spades')).toHaveLength(13);
    expect(deck.filter((c) => c.suit === 'diamonds')).toHaveLength(9);
    expect(deck.filter((c) => c.suit === 'hearts')).toHaveLength(9);
  });

  it('has no red faces or red aces', () => {
    for (const c of buildDeck()) {
      if (c.suit === 'diamonds' || c.suit === 'hearts') {
        expect(c.value).toBeGreaterThanOrEqual(2);
        expect(c.value).toBeLessThanOrEqual(10);
      }
    }
  });

  it('labels faces and aces correctly', () => {
    expect(labelFor(11)).toBe('J');
    expect(labelFor(12)).toBe('Q');
    expect(labelFor(13)).toBe('K');
    expect(labelFor(14)).toBe('A');
    expect(labelFor(7)).toBe('7');
  });
});

describe('setup', () => {
  it('deals a room of 4 and starts at 20 health', () => {
    const s = startGame();
    expect(s.room).toHaveLength(4);
    expect(s.dungeon).toHaveLength(40);
    expect(s.health).toBe(20);
    expect(s.phase).toBe('playing');
  });
});

describe('combat', () => {
  it('fights barehanded taking full damage and resolving the card', () => {
    const room = [card('clubs', 7), card('hearts', 2), card('diamonds', 5), card('spades', 3)];
    let s = startGame(room, { shuffle: false });
    s = fightMonster(s, 'clubs-7', false);
    expect(s.health).toBe(13);
    expect(s.room).toHaveLength(3);
    expect(s.resolved).toBe(1);
  });

  it('subtracts weapon value from monster damage', () => {
    const room = [card('diamonds', 5), card('clubs', 8), card('hearts', 2), card('spades', 2)];
    let s = startGame(room, { shuffle: false });
    s = equipWeapon(s, 'diamonds-5');
    s = fightMonster(s, 'clubs-8', true);
    expect(s.health).toBe(17);
    expect(s.weapon?.defeated.map((c) => c.value)).toEqual([8]);
  });

  it('takes no damage when the weapon is stronger than the monster', () => {
    const room = [card('diamonds', 9), card('clubs', 4), card('hearts', 2), card('spades', 2)];
    let s = startGame(room, { shuffle: false });
    s = equipWeapon(s, 'diamonds-9');
    s = fightMonster(s, 'clubs-4', true);
    expect(s.health).toBe(20);
  });

  it('a fresh weapon can fight any monster, then only strictly weaker ones', () => {
    const room = [card('diamonds', 5), card('clubs', 10), card('spades', 10), card('clubs', 9)];
    let s = startGame(room, { shuffle: false });
    s = equipWeapon(s, 'diamonds-5');
    expect(canUseWeapon(s.weapon!, card('clubs', 14))).toBe(true);
    s = fightMonster(s, 'clubs-10', true);
    expect(canUseWeapon(s.weapon!, card('clubs', 10))).toBe(false);
    expect(canUseWeapon(s.weapon!, card('spades', 10))).toBe(false);
    expect(canUseWeapon(s.weapon!, card('clubs', 9))).toBe(true);
    expect(canUseWeapon(s.weapon!, card('clubs', 8))).toBe(true);
  });
});

describe('potions', () => {
  it('heals and caps at 20', () => {
    const room = [card('clubs', 9), card('hearts', 5), card('spades', 2), card('hearts', 3)];
    let s = startGame(room, { shuffle: false });
    s = fightMonster(s, 'clubs-9', false);
    expect(s.health).toBe(11);
    s = drinkPotion(s, 'hearts-5');
    expect(s.health).toBe(16);
    s = drinkPotion(s, 'hearts-3');
    expect(s.health).toBe(16);
  });

  it('allows a potion again in the next room', () => {
    let s = startGame(
      [
        card('clubs', 3), card('spades', 5), card('diamonds', 6), card('hearts', 4),
        card('spades', 2), card('clubs', 2), card('spades', 3), card('hearts', 5),
      ],
      { shuffle: false },
    );
    expect(s.room.map((c) => c.id)).toEqual(['hearts-5', 'spades-3', 'clubs-2', 'spades-2']);
    s = drinkPotion(s, 'hearts-5');
    s = fightMonster(s, 'spades-3', false);
    s = fightMonster(s, 'clubs-2', false);
    expect(s.room).toHaveLength(4);
    expect(s.room[0]).toEqual(card('spades', 2));
    s = drinkPotion(s, 'hearts-4');
    expect(s.health).toBe(19);
    expect(s.room).toHaveLength(3);
  });
});

describe('room flow', () => {
  it('carries the leftover card into the next room', () => {
    let s = startGame(
      [
        card('clubs', 5), card('spades', 6), card('diamonds', 7), card('hearts', 3),
        card('hearts', 2), card('diamonds', 2), card('spades', 2), card('clubs', 2),
      ],
      { shuffle: false },
    );
    s = fightMonster(s, 'clubs-2', false);
    s = fightMonster(s, 'spades-2', false);
    s = equipWeapon(s, 'diamonds-2');
    expect(s.carried).toBe(true);
    expect(s.room).toHaveLength(4);
    expect(s.room[0]).toEqual(card('hearts', 2));
    expect(s.dungeon).toHaveLength(1);
  });

  it('wins when the dungeon is fully cleared and scores health', () => {
    let s = startGame(
      [
        card('hearts', 2), card('spades', 2), card('clubs', 2), card('diamonds', 6),
      ],
      { shuffle: false },
    );
    s = equipWeapon(s, 'diamonds-6');
    s = fightMonster(s, 'clubs-2', true);
    s = fightMonster(s, 'spades-2', true);
    s = drinkPotion(s, 'hearts-2');
    expect(s.phase).toBe('won');
    expect(s.score).toBe(20);
  });

  it('loses at 0 health with a negative score from remaining dungeon monsters', () => {
    let s = startGame(
      [
        card('hearts', 2), card('diamonds', 2), card('spades', 3), card('spades', 2),
        card('clubs', 7), card('clubs', 8), card('clubs', 9), card('clubs', 10),
      ],
      { shuffle: false },
    );
    s = fightMonster(s, 'clubs-10', false);
    s = fightMonster(s, 'clubs-9', false);
    s = fightMonster(s, 'clubs-8', false);
    expect(s.phase).toBe('lost');
    expect(s.health).toBe(0);
    expect(s.score).toBe(-(2 + 3));
    expect(s.room).toHaveLength(1);
  });
});

describe('running away', () => {
  it('buries the room at the bottom of the dungeon and deals fresh cards', () => {
    let s = startGame(
      [
        card('clubs', 9), card('spades', 9), card('clubs', 8), card('spades', 8),
        card('hearts', 2), card('diamonds', 2), card('clubs', 3), card('spades', 4),
      ],
      { shuffle: false },
    );
    const buried = s.room;
    s = runAway(s);
    expect(s.ranLastRoom).toBe(true);
    expect(s.room).toHaveLength(4);
    expect(s.dungeon).toHaveLength(4);
    expect(s.dungeon.slice(0, 4)).toEqual(buried);
  });

  it('cannot run away twice in a row', () => {
    let s = startGame();
    s = runAway(s);
    const roomBefore = s.room;
    const dungeonBefore = s.dungeon;
    s = runAway(s);
    expect(s.room).toEqual(roomBefore);
    expect(s.dungeon).toEqual(dungeonBefore);
  });

  it('allows running again only after the next room is fully faced', () => {
    const cards: Card[] = [
      ...Array.from({ length: 8 }, (_, i) => ({ id: `c2-${i}`, suit: 'clubs' as const, value: 2 })),
      ...Array.from({ length: 4 }, (_, i) => ({ id: `h5-${i}`, suit: 'hearts' as const, value: 5 })),
      ...Array.from({ length: 4 }, (_, i) => ({ id: `d5-${i}`, suit: 'diamonds' as const, value: 5 })),
    ];
    let s = startGame(cards, { shuffle: false });
    s = runAway(s);
    expect(s.ranLastRoom).toBe(true);
    for (let room = 0; room < 2; room++) {
      for (let i = 0; i < 3 && s.phase === 'playing'; i++) {
        const c = s.room[0];
        s =
          c.suit === 'clubs' || c.suit === 'spades'
            ? fightMonster(s, c.id, false)
            : c.suit === 'diamonds'
              ? equipWeapon(s, c.id)
              : drinkPotion(s, c.id);
      }
    }
    expect(s.ranLastRoom).toBe(false);
    const deckBefore = s.dungeon.length;
    s = runAway(s);
    expect(s.ranLastRoom).toBe(true);
    expect(s.dungeon.length).toBe(deckBefore);
  });
});

describe('card kinds', () => {
  it('maps suits to kinds', () => {
    expect(cardKind(card('clubs', 5))).toBe('monster');
    expect(cardKind(card('spades', 14))).toBe('monster');
    expect(cardKind(card('diamonds', 10))).toBe('weapon');
    expect(cardKind(card('hearts', 10))).toBe('potion');
  });
});
