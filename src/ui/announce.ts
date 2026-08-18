/**
 * Maps engine Result payloads 1:1 onto screen-reader announcements (Q28b).
 * The single polite live region renders whatever this returns for the latest
 * result; sequenced re-render handles consecutive identical payloads.
 */
import type { Result, RunAwayBlockReason } from '../engine';
import { cardDisplayName } from './cards/cardMeta';

export function runAwayBlockText(reason?: RunAwayBlockReason): string {
  if (reason === 'twice-in-row') return "You can't run from two rooms in a row.";
  if (reason === 'no-cards') return 'The dungeon is too small to run — no new room can be dealt.';
  return 'There is no room to flee to.';
}

export function announceResult(result: Result): string | null {
  switch (result.type) {
    case 'MonsterDefeated': {
      const name = cardDisplayName(result.cardId);
      const how = result.usedWeaponId !== undefined ? 'with your weapon' : 'barehanded';
      const dmg = result.damage === 0 ? 'no damage' : `${result.damage} damage`;
      const broke = result.weaponBroke ? ' Your weapon broke.' : '';
      return `Fought ${name} ${how}. Took ${dmg}.${broke}`;
    }
    case 'WeaponEquipped': {
      const name = cardDisplayName(result.cardId);
      const discarded =
        result.discardedWeaponId !== undefined
          ? ` Discarded ${cardDisplayName(result.discardedWeaponId)} and ${result.discardedMonsterIds.length} slain monster${result.discardedMonsterIds.length === 1 ? '' : 's'}.`
          : '';
      return `Equipped ${name}.${discarded}`;
    }
    case 'PotionQuaffed': {
      const name = cardDisplayName(result.cardId);
      if (result.wasted) return `${name} discarded — the potion is wasted.`;
      return `Drank ${name}. Healed ${result.healed} HP.`;
    }
    case 'RanAway':
      return 'You ran away. A new room is dealt.';
    case 'RunAwayBlocked':
      return runAwayBlockText(result.reason);
    case 'RoomDealt':
      return `A room of ${result.cards.length} cards is dealt.`;
    case 'UndoDone':
      return 'Room rewound to its start.';
    case 'InvalidAction':
      return `That move is not allowed: ${result.reason}.`;
    case 'GameWon':
      return `You survived the dungeon! Final score ${result.score}.`;
    case 'GameLost':
      return `You died in the dungeon. Final score ${result.score}.`;
    default:
      return null;
  }
}
