import { useEffect, useState } from 'react';
import type { CardId } from '../../engine';
import type { PlayTableHandle } from '../../game';

/**
 * One source of truth: the mount contract lives in `src/game` (`index.ts`).
 * This is a type-only import — erased at runtime — so the RTL-tested import
 * chain still never loads `src/game`/Phaser (jsdom has no canvas/WebGL); the
 * real handle is created via the dynamic import in PlayScreen's table region.
 */
export type { PlayTableHandle };

/**
 * The Phase 2 motion-era members (`onRunEnded`, `setReducedMotion`) are part
 * of the landed `PlayTableHandle` in `src/game` — the single source of truth,
 * so no local extension is declared here. These helpers only null-guard the
 * handle for the pre-mount window.
 */

/** Subscribes to the run-ended channel (fires once, after the flourish). */
export function subscribeRunEnded(
  handle: PlayTableHandle | null,
  cb: (info: { outcome: 'won' | 'lost' }) => void,
): () => void {
  return handle === null ? () => undefined : handle.onRunEnded(cb);
}

/** Pushes a reduced-motion change to the game's live toggle. */
export function applyReducedMotion(handle: PlayTableHandle | null, reduced: boolean): void {
  if (handle !== null) {
    handle.setReducedMotion(reduced);
  }
}

export interface CardHover {
  cardId: CardId;
  /** Cursor position (client coordinates) at the moment hover started. */
  x: number;
  y: number;
}

/**
 * Bridges Phaser sprite hover to DOM (docs/phaser-plan.md §3): subscribes to
 * the handle's hover channel, tracks the cursor with a capture-phase window
 * listener (canvas pointer events bubble there — no handle API needed), and
 * returns the hovered card + cursor position, or null when nothing is hovered.
 * The tooltip rendering itself reuses `Tooltip`'s positioning/flip logic via
 * `CursorTooltip` (`CardHoverLayer` composes the two).
 */
export function useCardHover(handle: PlayTableHandle | null): CardHover | null {
  const [hover, setHover] = useState<CardHover | null>(null);

  useEffect(() => {
    if (handle === null) return;
    const cursor = { x: 0, y: 0 };
    const onPointerMove = (event: PointerEvent) => {
      cursor.x = event.clientX;
      cursor.y = event.clientY;
      // Follow the cursor while a sprite is hovered; no-op otherwise.
      setHover((current) => (current === null ? null : { ...current, x: cursor.x, y: cursor.y }));
    };
    window.addEventListener('pointermove', onPointerMove, true);
    const offHover = handle.onHover((cardId) => {
      setHover(cardId === null ? null : { cardId, x: cursor.x, y: cursor.y });
    });
    return () => {
      window.removeEventListener('pointermove', onPointerMove, true);
      offHover();
    };
  }, [handle]);

  return hover;
}
