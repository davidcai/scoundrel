import type { Card, EquippedWeapon, GameState } from './types';

export const isMonster = (card: Card): boolean =>
  card.suit === 'spades' || card.suit === 'clubs';

export const isWeapon = (card: Card): boolean => card.suit === 'diamonds';

export const isPotion = (card: Card): boolean => card.suit === 'hearts';

/**
 * Weapon degradation: a weapon that has killed may only fight monsters
 * strictly lower than the last monster it killed (top of the kill stack).
 */
export function canWeaponFight(weapon: EquippedWeapon, monster: Card): boolean {
  const lastKill = weapon.kills[weapon.kills.length - 1];
  if (!lastKill) return true;
  return monster.value < lastKill.value;
}

/** Damage taken when fighting a monster. */
export function fightDamage(
  monster: Card,
  weapon: EquippedWeapon | null,
  useWeapon: boolean,
): number {
  if (!useWeapon || !weapon) return monster.value;
  return Math.max(0, monster.value - weapon.card.value);
}

/**
 * Loss score: per docs/rules.md, subtract the values of all unplayed
 * monsters left in the dungeon deck from 0. (Unresolved room cards are
 * not counted — literal reading of the rule.)
 */
export function lossScore(state: GameState): number {
  const remaining = state.deck
    .filter(isMonster)
    .reduce((sum, c) => sum + c.value, 0);
  return -remaining;
}

/** Short display name, e.g. "A♠", "10♥". */
export function cardLabel(card: Card): string {
  const rank =
    card.rank === 14
      ? 'A'
      : card.rank === 13
        ? 'K'
        : card.rank === 12
          ? 'Q'
          : card.rank === 11
            ? 'J'
            : String(card.rank);
  const suit = { spades: '♠', clubs: '♣', diamonds: '♦', hearts: '♥' }[
    card.suit
  ];
  return `${rank}${suit}`;
}
