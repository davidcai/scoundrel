import type { Card, Rank, Suit, CardType, CombatResult } from './types';

export const MAX_HEALTH = 20;

export function rankToLabel(rank: Rank): string {
  if (rank === 11) return 'J';
  if (rank === 12) return 'Q';
  if (rank === 13) return 'K';
  if (rank === 14) return 'A';
  return String(rank);
}

export function suitToSymbol(suit: Suit): string {
  switch (suit) {
    case 'hearts': return '♥';
    case 'diamonds': return '♦';
    case 'clubs': return '♣';
    case 'spades': return '♠';
  }
}

export function suitIsRed(suit: Suit): boolean {
  return suit === 'hearts' || suit === 'diamonds';
}

export function getCardType(card: Card): CardType {
  if (card.suit === 'clubs' || card.suit === 'spades') return 'monster';
  if (card.suit === 'diamonds') return 'weapon';
  return 'potion';
}

export function createDeck(): Card[] {
  const deck: Card[] = [];
  const allSuits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
  const ranks: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

  for (const suit of allSuits) {
    for (const rank of ranks) {
      if (suitIsRed(suit)) {
        if (rank === 11 || rank === 12 || rank === 13 || rank === 14) {
          continue;
        }
      }
      deck.push({
        id: `${suit}-${rank}`,
        suit,
        rank,
      });
    }
  }
  return deck;
}

export function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function createShuffledDeck(): Card[] {
  return shuffle(createDeck());
}

export function canWeaponFightMonster(
  lastKilledValue: Rank | null,
  monsterRank: Rank,
): boolean {
  if (lastKilledValue === null) return true;
  return monsterRank < lastKilledValue;
}

export function resolveCombat(
  monster: Card,
  weapon: { card: Card; lastKilledValue: Rank | null } | null,
): CombatResult {
  if (weapon && canWeaponFightMonster(weapon.lastKilledValue, monster.rank)) {
    const damage = Math.max(0, monster.rank - weapon.card.rank);
    return {
      damage,
      monsterDefeated: true,
      usedWeapon: true,
    };
  }
  return {
    damage: monster.rank,
    monsterDefeated: true,
    usedWeapon: false,
  };
}

export function calculateHeal(potion: Card, currentHealth: number): number {
  return Math.min(MAX_HEALTH, currentHealth + potion.rank) - currentHealth;
}

export function calculateWinScore(health: number): number {
  return Math.min(MAX_HEALTH, health);
}

export function calculateLoseScore(remainingMonsters: Card[]): number {
  const sum = remainingMonsters.reduce((acc, c) => acc + c.rank, 0);
  return sum === 0 ? 0 : -sum;
}

export function getRemainingMonstersFromDeck(deck: Card[]): Card[] {
  return deck.filter((c) => getCardType(c) === 'monster');
}

export function cardsNeededToResolve(roomSize: number): number {
  if (roomSize <= 1) return 0;
  return roomSize - 1;
}
