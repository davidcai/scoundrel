import {
  isFinalRoom,
  type GameResult,
  type GameState,
  type InvalidActionReason,
  type RunAwayBlockReason,
} from '../engine';
import { cardLabel, t } from '../i18n';

/**
 * Result payloads → human-readable announcements. These strings feed the ARIA
 * live region (and double as visible action feedback). Localized via i18n.
 */
export function announce(result: GameResult, state: GameState): string {
  switch (result.type) {
    case 'RunStarted':
      return t('announceRunStarted', { seed: result.seed });
    case 'RoomDealt':
      return isFinalRoom(state)
        ? t('announceFinalRoom')
        : result.carriedFrom
          ? t('announceRoomCarried', { card: cardLabel(result.carriedFrom) })
          : t('announceRoom');
    case 'MonsterDefeated': {
      const bare = result.usedWeaponId === null;
      if (result.damage > 0) {
        return bare
          ? t('slainBareDamage', { card: cardLabel(result.cardId), damage: result.damage })
          : t('slainWeaponDamage', {
              card: cardLabel(result.cardId),
              weapon: cardLabel(result.usedWeaponId!),
              damage: result.damage,
            });
      }
      return bare
        ? t('slainBareClean', { card: cardLabel(result.cardId) })
        : t('slainWeaponClean', {
            card: cardLabel(result.cardId),
            weapon: cardLabel(result.usedWeaponId!),
          });
    }
    case 'WeaponEquipped': {
      const equip = t('announceEquip', { card: cardLabel(result.cardId) });
      return result.discardedWeaponId !== null
        ? `${equip} ${t('announceEquipDiscard', { count: result.discardedMonsterIds.length })}`
        : equip;
    }
    case 'PotionQuaffed':
      return result.wasted
        ? t('announcePotionWasted', { card: cardLabel(result.cardId) })
        : t('announcePotionHeal', { card: cardLabel(result.cardId), healed: result.healed });
    case 'RanAway':
      return t('announceRanAway');
    case 'RunAwayBlocked':
      return t('announceRunBlocked', { reason: runAwayBlockMessage(result.reason) });
    case 'UndoDone':
      return t('announceUndo');
    case 'InvalidAction':
      return t('announceInvalid', { reason: invalidActionMessage(result.reason) });
    case 'GameWon':
      return t('announceGameWon', { score: result.score });
    case 'GameLost':
      return t('announceGameLost', { score: result.score });
  }
}

function runAwayBlockMessage(reason: RunAwayBlockReason): string {
  switch (reason) {
    case 'twice-in-a-row':
      return t('blockTwice');
    case 'final-room':
      return t('blockFinalRoom');
    case 'already-engaged':
      return t('blockEngaged');
  }
}

function invalidActionMessage(reason: InvalidActionReason): string {
  switch (reason) {
    case 'game-over':
      return t('invalidGameOver');
    case 'not-in-room':
      return t('invalidNotInRoom');
    case 'not-a-monster':
      return t('invalidNotMonster');
    case 'not-a-weapon':
      return t('invalidNotWeapon');
    case 'not-a-potion':
      return t('invalidNotPotion');
    case 'room-complete':
      return t('invalidRoomComplete');
    case 'weapon-too-weak':
      return t('invalidWeaponTooWeak');
    case 'no-snapshot':
      return t('invalidNoSnapshot');
    case 'not-dealt':
      return t('invalidNotDealt');
    case 'room-active':
      return t('invalidRoomActive');
    case 'room-not-resolved':
      return t('invalidRoomNotResolved');
    case 'final-room':
      return t('blockFinalRoom');
  }
}
