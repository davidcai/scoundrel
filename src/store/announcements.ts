import { cardLabel, isFinalRoom } from '../engine';
import type { GameResult, GameState, InvalidActionReason, RunAwayBlockReason } from '../engine';

/**
 * Result payloads → human-readable announcements. These strings feed the ARIA
 * live region (and double as visible action feedback).
 */
export function announce(result: GameResult, state: GameState): string {
  switch (result.type) {
    case 'RunStarted':
      return `A new run begins. Seed ${result.seed}.`;
    case 'RoomDealt':
      return isFinalRoom(state)
        ? 'The final room appears. Resolve every card to win!'
        : result.carriedFrom
          ? `A new room appears. ${cardLabel(result.carriedFrom)} carried over from the last room.`
          : 'A new room appears.';
    case 'MonsterDefeated': {
      const weapon = result.usedWeaponId
        ? ` with your ${cardLabel(result.usedWeaponId)}`
        : ' barehanded';
      return result.damage > 0
        ? `You slay the ${cardLabel(result.cardId)}${weapon}, taking ${result.damage} damage.`
        : `You slay the ${cardLabel(result.cardId)}${weapon} without a scratch.`;
    }
    case 'WeaponEquipped': {
      const discard =
        result.discardedWeaponId !== null
          ? ` Your old weapon and ${result.discardedMonsterIds.length} slain monsters are discarded.`
          : '';
      return `You equip the ${cardLabel(result.cardId)}.${discard}`;
    }
    case 'PotionQuaffed':
      return result.wasted
        ? `You drink the ${cardLabel(result.cardId)}, but it restores nothing.`
        : `You drink the ${cardLabel(result.cardId)} and recover ${result.healed} health.`;
    case 'RanAway':
      return 'You flee the room. The cards sink to the bottom of the dungeon.';
    case 'RunAwayBlocked':
      return `You cannot run away: ${runAwayBlockMessage(result.reason)}.`;
    case 'UndoDone':
      return 'The room rewinds to its start.';
    case 'InvalidAction':
      return `That action is not allowed: ${invalidActionMessage(result.reason)}.`;
    case 'GameWon':
      return `Victory! You clear the dungeon with ${result.score} health remaining.`;
    case 'GameLost':
      return `You are defeated. Final score ${result.score}.`;
  }
}

function runAwayBlockMessage(reason: RunAwayBlockReason): string {
  switch (reason) {
    case 'twice-in-a-row':
      return 'you cannot run from two rooms in a row';
    case 'final-room':
      return 'this is the final room';
    case 'already-engaged':
      return 'you have already engaged this room';
  }
}

function invalidActionMessage(reason: InvalidActionReason): string {
  switch (reason) {
    case 'game-over':
      return 'the run is over';
    case 'not-in-room':
      return 'that card is not in the room';
    case 'not-a-monster':
      return 'that card is not a monster';
    case 'not-a-weapon':
      return 'that card is not a weapon';
    case 'not-a-potion':
      return 'that card is not a health potion';
    case 'room-complete':
      return 'enough cards are resolved — enter the next room';
    case 'weapon-too-weak':
      return 'your weapon can only fight weaker monsters';
    case 'no-snapshot':
      return 'there is nothing to undo';
    case 'not-dealt':
      return 'no room has been dealt';
    case 'room-active':
      return 'a room is already in progress';
    case 'room-not-resolved':
      return 'resolve 3 of the 4 cards first';
    case 'final-room':
      return 'this is the final room';
  }
}
