import type { CardId, GameState } from '../engine';

/**
 * Presentation surface the bridge drives (Phaser-free so bridge unit tests can
 * stub it under jsdom — Phaser itself must never load under vitest).
 *
 * Phase 2: the bridge issues structured tween commands derived from `GameResult`
 * payloads; the scene plays named tweens (or, under reduced motion, jumps every
 * target straight to its end state).
 */

/** Post-flourish gate signal (fired exactly once per run end, never on undo). */
export interface RunEndedInfo {
  outcome: 'won' | 'lost';
}

/**
 * The terminal action's presentation, reconstructed by the bridge from the
 * state diff: `GameWon`/`GameLost` REPLACE the base result via `withTerminal`
 * (engine.ts:162), so the killing blow / final resolve has no payload.
 */
export interface TerminalPresentation {
  /** post.hp − pre.hp (negative for the killing blow). */
  hpDelta: number;
  hpBefore: number;
  hpAfter: number;
  /** Monster appended to the kill stack by the killing blow (weapon kill), if any. */
  killAppendedId: CardId | null;
  /** Room cards removed by the terminal resolve. */
  removedFromRoom: readonly CardId[];
  /** Room cards that appeared (defensive; rooms do not gain cards at terminal). */
  addedToRoom: readonly CardId[];
  weaponBefore: CardId | null;
  weaponAfter: CardId | null;
  /**
   * Phase 3 weapon-strain flash, re-derived by the bridge via `previewFight`:
   * true only when the terminal kill was barehanded while the held weapon was
   * too weak for it (the weapon failed — engine.ts has no break path; see
   * deriveWeaponBreak in store-bridge.ts). Never set on honest equips/swaps.
   */
  weaponBreak: boolean;
}

/** What a consumed `GameResult` tells the scene to do. */
export type BridgeCommand =
  /** RoomDealt: cards slide into the room (staggered); a carried card slides forward. */
  | { kind: 'deal'; cards: readonly CardId[]; carriedFrom: CardId | null }
  /** MonsterDefeated: lunge/impact + floating damage; weapon kills drop onto the stack. */
  | {
      kind: 'attack';
      cardId: CardId;
      damage: number;
      usedWeaponId: CardId | null;
      /** Set when the kill joins the kill stack (weapon kill). */
      killCardId: CardId | null;
      /**
       * Weapon-strain flash, re-derived by the bridge via `previewFight` on the
       * pre-action state: the kill was barehanded AND the held weapon was too
       * weak for it. `result.weaponBroke` is vestigial (always false) and
       * `discardedWeaponId` fires on honest swaps — never key to those.
       */
      weaponBreak: boolean;
    }
  /** PotionQuaffed: glow pulse on the quaffed card + HP feedback. */
  | { kind: 'potion'; cardId: CardId; healed: number; wasted: boolean }
  /** WeaponEquipped: weapon slides to its zone; old stack sweeps to discard. */
  | {
      kind: 'weaponEquip';
      cardId: CardId;
      discardedWeaponId: CardId | null;
      discardedMonsterIds: readonly CardId[];
    }
  /** RanAway: room sweeps out before the fresh room deals in. */
  | { kind: 'runAway'; newCards: readonly CardId[] }
  /** GameWon/GameLost: terminal-diff reconstruction first, then the flourish. */
  | { kind: 'terminal'; outcome: 'won' | 'lost'; reconstruction: TerminalPresentation | null }
  /** RunAwayBlocked/InvalidAction: subtle shake — comes from lastResult, never the diff. */
  | { kind: 'errorFeedback' }
  /** Undo/mismatch/hydrate: unreachable by forward tweens — cross-fade rebuild. */
  | { kind: 'rebuild' }
  /** Nothing to present. */
  | { kind: 'noop' };

export interface TableSceneApi {
  /**
   * Full instant re-render of the play state (snapshot first sync). `null`
   * clears the table. NOT used for resolve/room-transition presentation in
   * Phase 2 — those flow through `playCommand`.
   */
  renderState(state: GameState | null, selectedCardId: CardId | null): void;
  /** Play a presentation command (tweens, or end-state jumps under reduced motion). */
  playCommand(command: BridgeCommand, state: GameState | null, selectedCardId: CardId | null): void;
  /** Move/clear the selection highlight (lift + ring). Must be idempotent. */
  setSelection(cardId: CardId | null): void;
  /** Live reduced-motion toggle (also honored at create via opts.reducedMotion). */
  setReducedMotion(reduced: boolean): void;
  /** Register the pointerdown → `selectCard` toggle hook (room cards only). */
  onCardPointerDown(cb: (cardId: CardId) => void): void;
  /** Sprite pointerover/pointerout forwarding; returns an unsubscribe function. */
  onHoverChange(cb: (cardId: CardId | null) => void): () => void;
  /** Scene → bridge: fires after the terminal flourish choreography completes. */
  onFlourishComplete(cb: (info: RunEndedInfo) => void): void;
  destroy(): void;
}
