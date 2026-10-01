import type { CardId, GameState } from '../engine';
import type { Rect } from './board-layout';
import { MAX_PROJECTION_CARDS, type BoardProjection, type ProjectionCard } from './board-protocol';

/**
 * Engine state → wire projection (godot-plan.md, "Compute in TypeScript once
 * and transmit rectangles"). The ONLY place engine truth is translated into
 * the visual DTO: the Godot frame never sees GameState, the dungeon, settings,
 * or undo snapshots — only room cards + their authoritative TypeScript layout
 * rects, selection/carried identity, phase, and the effective motion policy.
 *
 * Rects come from the SAME `computeBoardLayout` + `readRoomMetrics` path the
 * DOM hit-layer uses (fed via props from PlayScreen's `useBoardLayout`), so
 * Godot sprites, DOM buttons and tooltips cannot drift. Rects are relative to
 * the `.room` border box — the frame's own coordinate space.
 *
 * Pre-measurement (`measured === false`, jsdom, or a zero-size hidden room)
 * yields an empty-room projection: the frame receives truth without geometry
 * and the host simply hasn't sent a valid layout yet ("Ignore zero-size
 * hidden layouts until a valid measurement arrives").
 */

export interface ProjectionLayout {
  /** One rect per room card, in room-box coordinates, from useBoardLayout. */
  rects: Rect[];
  /** False until the first valid ResizeObserver measurement. */
  measured: boolean;
}

export interface ProjectionInputs {
  state: GameState | null;
  selectedCardId: CardId | null;
  /** Effective reduced motion (stored preference OR prefers-reduced-motion). */
  reducedMotion: boolean;
  layout: ProjectionLayout;
}

/**
 * Build the visual projection. Defensive against rooms longer than 4 cards:
 * like the Phaser scene, extra cards get no rect and are not transmitted.
 */
export function buildBoardProjection(inputs: ProjectionInputs): BoardProjection {
  const { state, selectedCardId, reducedMotion, layout } = inputs;
  const room: ProjectionCard[] = [];
  if (state !== null && layout.measured) {
    const count = Math.min(state.room.length, MAX_PROJECTION_CARDS, layout.rects.length);
    for (let i = 0; i < count; i++) {
      const cardId = state.room[i];
      const rect = layout.rects[i];
      if (cardId === undefined || rect === undefined) break;
      room.push({
        cardId,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      });
    }
  }
  return {
    room,
    selectedCardId:
      selectedCardId !== null && room.some((c) => c.cardId === selectedCardId)
        ? selectedCardId
        : null,
    carriedCardId: state?.carriedCardId ?? null,
    phase: state?.phase ?? 'playing',
    reducedMotion,
  };
}
