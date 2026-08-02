import type { Card, CardKind, EquippedWeapon, GameState, Suit } from './types';
import { HEALTH_MAX } from './constants';

export function cardKind(card: Card): CardKind {
  return kindForSuit(card.suit);
}

export function kindForSuit(suit: Suit): CardKind {
  if (suit === 'clubs' || suit === 'spades') return 'monster';
  if (suit === 'diamonds') return 'weapon';
  return 'potion';
}

export function isMonster(card: Card): boolean {
  return cardKind(card) === 'monster';
}

export function canUseWeapon(weapon: EquippedWeapon | null, monsterValue: number): boolean {
  if (!weapon) return false;
  return weapon.lastKilledValue === null || monsterValue < weapon.lastKilledValue;
}

export function combatDamage(weaponValue: number, monsterValue: number): number {
  return Math.max(0, monsterValue - weaponValue);
}

export function healAmount(health: number, value: number, max = HEALTH_MAX): number {
  const target = Math.min(max, health + value);
  return target - health;
}

export function isRed(card: Card): boolean {
  return card.suit === 'hearts' || card.suit === 'diamonds';
}

export function canRun(state: GameState): boolean {
  return (
    state.phase === 'playing' &&
    !state.roomComplete &&
    state.dealtSize === 4 &&
    state.room.length === 4 &&
    state.resolvedCount === 0 &&
    !state.ranLastRoom &&
    state.dungeon.length >= 4
  );
}

export function monsterValuesSum(cards: Card[]): number {
  return cards.reduce((total, card) => (isMonster(card) ? total + card.value : total), 0);
}