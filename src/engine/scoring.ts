/**
 * Scoring rules for the Scoundrel rules engine.
 *
 * Rules.md, "Winning and Losing": a win scores surviving health; a loss scores
 * the negative sum of the monster values still in the face-down draw pile.
 * Face-up room cards, including a carried card, are not in the dungeon and are
 * never counted. An empty draw pile therefore scores 0 but the outcome is still
 * a loss.
 */

import { cardValue, isMonster, type CardId } from './cards';

/** Sum the values of the monsters in a set of cards; non-monsters add nothing. */
export function sumMonsterValues(cards: readonly CardId[]): number {
  return cards.reduce((total, card) => (isMonster(card) ? total + cardValue(card) : total), 0);
}

/** The loss score for the monsters remaining in the dungeon draw pile. */
export function calculateLossScore(dungeon: readonly CardId[]): number {
  const monsters = sumMonsterValues(dungeon);
  // Normalize -0 to 0: an empty draw pile scores zero (PRD REQ-013 wording).
  return monsters === 0 ? 0 : -monsters;
}
