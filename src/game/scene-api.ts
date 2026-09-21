import type { CardId, GameState } from '../engine';

/**
 * Presentation surface the bridge drives (Phaser-free so bridge unit tests can
 * stub it under jsdom — Phaser itself must never load under vitest).
 *
 * Phase 1 is static: every command that touches the table is an instant
 * `renderState` from authoritative state. The `kind` discriminator keeps the
 * mapping structure ready for Phase 2 tweens (deal/resolve/rebuild differ).
 */
export interface TableSceneApi {
  /**
   * Full static re-render of the play state (snapshot first sync, undo/mismatch
   * rebuild, and every resolve in Phase 1). `null` clears the table.
   */
  renderState(state: GameState | null, selectedCardId: CardId | null): void;
  /** Move/clear the selection highlight. Must be idempotent — same id is a no-op. */
  setSelection(cardId: CardId | null): void;
  /** Register the pointerdown → `selectCard` toggle hook (room cards only). */
  onCardPointerDown(cb: (cardId: CardId) => void): void;
  /** Sprite pointerover/pointerout forwarding; returns an unsubscribe function. */
  onHoverChange(cb: (cardId: CardId | null) => void): () => void;
  destroy(): void;
}

/** What a consumed `GameResult` tells the scene to do. */
export type BridgeCommand =
  /**
   * A resolve/room transition changed the table — render the post-action state.
   * (Phase 2: plays the matching tween instead of an instant render.)
   */
  | { kind: 'render'; cardId: CardId | null }
  /** The rendered state is unreachable by forward tweens — full rebuild from state. */
  | { kind: 'rebuild' }
  /** No-op state diff (error/blocked feedback in Phase 2; silence is deliberate here). */
  | { kind: 'noop' };
