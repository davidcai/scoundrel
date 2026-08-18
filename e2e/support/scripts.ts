/**
 * Embedded deterministic scripts and expectations (spec Seam 3, seeded runs).
 *
 * Provenance: computed offline against the real engine with a beam-search
 * solver (win seed) and a maximal-damage policy (loss seed), then embedded
 * verbatim. Specs replay these through live engine re-simulation *and* the
 * real UI; any engine behavior change breaks the validation loudly.
 */
import type { Action, CardId } from '../../src/engine/index.ts'

/** Seeded URL everywhere in the suite uses the canonical config encoding. */
export const CANON_CODE = 'o1d'

/* --------------------------------------------------------------------- */
/* Full WIN run: seed '15' → GameWon, final score 2 (hp 2).              */
/* --------------------------------------------------------------------- */

export const WIN_SEED = '15'
export const WIN_FIRST_ROOM: CardId[] = ['heart-2', 'club-2', 'diamond-7', 'heart-4']
export const WIN_FINAL_SCORE = 2
export const WIN_FINAL_HP = 2
export const WIN_REPLAY_HASH = '#/play?seed=15&config=o1d'

export const WIN_ACTIONS: Action[] = [
  { type: 'StartNewRun', seed: '15', config: { runAwayMode: 'once', potionsPerRoom: 1, weaponDegradation: true } },
  { type: 'FightMonster', cardId: 'club-2', barehanded: true },
  { type: 'DrinkPotion', cardId: 'heart-2' },
  { type: 'DrinkPotion', cardId: 'heart-4' },
  { type: 'EnterNextRoom' },
  { type: 'EquipWeapon', cardId: 'diamond-5' },
  { type: 'FightMonster', cardId: 'club-7', barehanded: false },
  { type: 'EquipWeapon', cardId: 'diamond-4' },
  { type: 'EnterNextRoom' },
  { type: 'RunAway' },
  { type: 'FightMonster', cardId: 'club-9', barehanded: false },
  { type: 'DrinkPotion', cardId: 'heart-9' },
  { type: 'FightMonster', cardId: 'spade-4', barehanded: false },
  { type: 'EnterNextRoom' },
  { type: 'EquipWeapon', cardId: 'diamond-8' },
  { type: 'FightMonster', cardId: 'spade-k', barehanded: false },
  { type: 'DrinkPotion', cardId: 'heart-3' },
  { type: 'EnterNextRoom' },
  { type: 'FightMonster', cardId: 'club-q', barehanded: false },
  { type: 'DrinkPotion', cardId: 'heart-6' },
  { type: 'FightMonster', cardId: 'spade-j', barehanded: false },
  { type: 'EnterNextRoom' },
  { type: 'DrinkPotion', cardId: 'heart-10' },
  { type: 'FightMonster', cardId: 'club-8', barehanded: false },
  { type: 'EquipWeapon', cardId: 'diamond-6' },
  { type: 'EnterNextRoom' },
  { type: 'FightMonster', cardId: 'club-6', barehanded: false },
  { type: 'FightMonster', cardId: 'spade-3', barehanded: false },
  { type: 'DrinkPotion', cardId: 'heart-7' },
  { type: 'EnterNextRoom' },
  { type: 'FightMonster', cardId: 'spade-2', barehanded: false },
  { type: 'EquipWeapon', cardId: 'diamond-2' },
  { type: 'EquipWeapon', cardId: 'diamond-10' },
  { type: 'EnterNextRoom' },
  { type: 'FightMonster', cardId: 'club-a', barehanded: false },
  { type: 'DrinkPotion', cardId: 'heart-5' },
  { type: 'FightMonster', cardId: 'club-j', barehanded: false },
  { type: 'EnterNextRoom' },
  { type: 'RunAway' },
  { type: 'FightMonster', cardId: 'spade-10', barehanded: false },
  { type: 'FightMonster', cardId: 'club-3', barehanded: true },
  { type: 'DrinkPotion', cardId: 'heart-8' },
  { type: 'EnterNextRoom' },
  { type: 'RunAway' },
  { type: 'FightMonster', cardId: 'spade-8', barehanded: false },
  { type: 'FightMonster', cardId: 'spade-7', barehanded: false },
  { type: 'EquipWeapon', cardId: 'diamond-7' },
  { type: 'EnterNextRoom' },
  { type: 'FightMonster', cardId: 'spade-9', barehanded: false },
  { type: 'FightMonster', cardId: 'spade-6', barehanded: false },
  { type: 'EquipWeapon', cardId: 'diamond-3' },
  { type: 'EnterNextRoom' },
  { type: 'FightMonster', cardId: 'spade-5', barehanded: false },
  { type: 'FightMonster', cardId: 'club-4', barehanded: false },
  { type: 'EquipWeapon', cardId: 'diamond-9' },
  { type: 'EnterNextRoom' },
  { type: 'FightMonster', cardId: 'spade-a', barehanded: false },
  { type: 'FightMonster', cardId: 'club-k', barehanded: false },
  { type: 'FightMonster', cardId: 'spade-q', barehanded: false },
  { type: 'EnterNextRoom' },
  { type: 'FightMonster', cardId: 'club-10', barehanded: false },
  { type: 'FightMonster', cardId: 'club-5', barehanded: false },
]

/* --------------------------------------------------------------------- */
/* Full LOSS run: seed '1' → GameLost, exact score -178 (hp 0).          */
/* --------------------------------------------------------------------- */

export const LOSS_SEED = '1'
export const LOSS_FIRST_ROOM: CardId[] = ['heart-4', 'diamond-4', 'spade-7', 'diamond-8']
export const LOSS_FINAL_SCORE = -178
export const LOSS_FINAL_HP = 0

export const LOSS_ACTIONS: Action[] = [
  { type: 'StartNewRun', seed: '1', config: { runAwayMode: 'once', potionsPerRoom: 1, weaponDegradation: true } },
  { type: 'FightMonster', cardId: 'spade-7', barehanded: false },
  { type: 'DrinkPotion', cardId: 'heart-4' },
  { type: 'EquipWeapon', cardId: 'diamond-8' },
  { type: 'EnterNextRoom' },
  { type: 'FightMonster', cardId: 'spade-k', barehanded: true },
  { type: 'FightMonster', cardId: 'spade-2', barehanded: true },
  { type: 'DrinkPotion', cardId: 'heart-6' },
  { type: 'EnterNextRoom' },
  { type: 'FightMonster', cardId: 'spade-8', barehanded: true },
]

/* --------------------------------------------------------------------- */
/* Keyboard-driven room: seed '2', first room resolves 3 cards in slot   */
/* order (no weapon involved) leaving hp at exactly 3.                   */
/* --------------------------------------------------------------------- */

export const KBD_SEED = '2'
export const KBD_FIRST_ROOM: CardId[] = ['heart-3', 'club-k', 'club-4', 'heart-2']
export const KBD_CARRIED: CardId = 'heart-2'
export const KBD_HP_AFTER_ROOM = 3

/* The '1' first room (monster + potion + weapons) also drives the SR and  */
/* artwork specs.                                                          */
export const ANNOUNCE_SEED = '1'
