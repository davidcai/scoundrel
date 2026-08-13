/**
 * Maps every GameResult the reducer can return to one human sentence for the
 * screen-reader live region (US56, spec "Accessibility": announcements map
 * 1:1 to result payloads). Terminal results prepend the action that ended the
 * run (`via`), so the final blow/quaff is announced too.
 *
 * Kept as a pure function (no React) so the store can reduce a result to text
 * the moment it happens and tests can assert sentences without rendering.
 */

import type { ActionResult, CardId, GameConfig, GameResult } from '../../engine/types'
import { parseCard, SUIT_META } from '../components'

/** "8C" → "8 of Clubs"; falls back to the raw id for malformed ids. */
function cardName(cardId: CardId): string {
  const parsed = parseCard(cardId)
  if (parsed === null) return cardId
  return `${parsed.rank} of ${SUIT_META[parsed.suit].name}`
}

/** Verbatim-ish phrasing for the engine's stable InvalidAction reason literals. */
const INVALID_REASON_TEXT: Record<string, string> = {
  'not-playing': 'The run is not in progress.',
  'room-in-progress': 'Resolve this room before starting another.',
  'room-complete': 'This room is already resolved.',
  'no-cards': 'No cards left to deal.',
  'card-not-in-room': 'That card is not in this room.',
  'not-a-monster': 'That card is not a monster.',
  'not-a-potion': 'That card is not a potion.',
  'not-a-weapon': 'That card is not a weapon.',
  'weapon-degraded':
    'Your weapon is too worn — it can only fight monsters weaker than its last kill.',
  'no-room': 'There is no room to act on.',
  'no-snapshot': 'Nothing to undo.',
}

function invalidReasonText(reason: string): string {
  // Index lookup may be undefined (unknown future reasons) — fall back.
  return INVALID_REASON_TEXT[reason] ?? `That action is not allowed (${reason}).`
}

function actionText(result: ActionResult, config?: GameConfig): string {
  switch (result.type) {
    case 'MonsterDefeated': {
      const tail = result.weaponBroke ? ' Your weapon broke.' : ''
      return `${cardName(result.cardId)} defeated, took ${String(result.damage)} damage.${tail}`
    }
    case 'WeaponEquipped': {
      const discard =
        result.discardedWeaponId !== undefined
          ? ` ${cardName(result.discardedWeaponId)} and its kills were discarded.`
          : ''
      return `${cardName(result.cardId)} equipped.${discard}`
    }
    case 'PotionQuaffed':
      return result.wasted
        ? `${cardName(result.cardId)} poured out — only one potion heals per room.`
        : `${cardName(result.cardId)} quaffed, healed ${String(result.healed)}.`
    case 'RanAway':
      return config?.runAwayMode === 'unlimited'
        ? 'Ran away to a fresh room.'
        : 'Ran away — cannot run next room.'
    case 'RunAwayBlocked':
      return result.reason === 'twice-in-row'
        ? 'Cannot run away two rooms in a row.'
        : 'Too few cards remain in the dungeon to run away.'
    case 'RoomDealt':
      // StartNewRun's placeholder deal has no cards yet; the DealRoom that
      // follows immediately supersedes it.
      return result.cards.length === 0
        ? 'The dungeon is shuffled.'
        : `New room dealt, ${String(result.cards.length)} cards.`
    case 'UndoDone':
      return 'Rewound to the start of the room.'
    case 'InvalidAction':
      return invalidReasonText(result.reason)
  }
}

/** One sentence for any GameResult, terminal or not. */
export function resultToAnnouncement(result: GameResult, config?: GameConfig): string {
  switch (result.type) {
    case 'GameWon':
      return `${actionText(result.via, config)} You cleared the dungeon — victory with a score of ${String(result.score)}.`
    case 'GameLost':
      return `${actionText(result.via, config)} You fell in the dungeon — final score ${String(result.score)}.`
    default:
      return actionText(result, config)
  }
}
