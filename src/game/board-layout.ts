/**
 * PURE board geometry for the Phaser card table — zero phaser/DOM imports
 * (engine-purity rules apply). Consumed by BOTH the scene and (later) the DOM
 * hit-layer, so the two can never drift apart (phaser-adoption-plan, Phase 0
 * decision: Scale.RESIZE + shared layout function).
 *
 * The wrap rule and size clamps mirror the DOM board:
 *   - `.room` gap in src/styles.css: `clamp(10px, 2.5vw, 22px)`
 *   - `--card-w`: `clamp(132px, 19.5vw, 192px)`, `--card-h`: `card-w * 1.4`
 * The `vw` ratios are interpreted against the container width, which is the
 * deterministic approximation of the viewport the canvas box lives in.
 *
 * Phase 2 parity: BOTH consumers (the Phaser scene and the DOM hit-layer hook)
 * pass explicit {@link BoardMetrics} resolved from the `.room` computed style
 * (see src/game/board-metrics.ts), so the two can never drift — the fallback
 * viewport math below only serves the legacy no-metrics signature. With
 * padding metrics the layout mirrors the DOM flexbox model exactly: rows are
 * top-aligned at `padTop` (not vertically centered) and each row is centered
 * inside the content box (mirrors `justify-content: center`).
 */

/** --card-h = --card-w * 1.4. */
export const CARD_ASPECT = 1.4;
/** --card-w clamp bounds and the 19.5vw ratio. */
export const CARD_W_MIN = 132;
export const CARD_W_MAX = 192;
export const CARD_W_RATIO = 0.195;
/** .room gap clamp bounds and the 2.5vw ratio. */
export const ROOM_GAP_MIN = 10;
export const ROOM_GAP_MAX = 22;
export const ROOM_GAP_RATIO = 0.025;
/** The room holds at most 4 cards. */
export const MAX_ROOM_CARDS = 4;

/**
 * Kill-stack fan step, absorbed from `KILL_STEP_X = 40; KILL_STEP_Y = 16` in
 * src/ui/WeaponStack.tsx. Per older-kill index i: the DOM uses
 * `right: i * 40, top: i * 16`; in canvas coordinates (x grows rightward) that
 * is dx = -KILL_STEP_X * i (older kills peek out to the LEFT), dy = +KILL_STEP_Y * i.
 */
export const KILL_STEP_X = 40;
export const KILL_STEP_Y = 16;

export interface Point {
  x: number;
  y: number;
}

/** Axis-aligned rect in container coordinates (origin = canvas top-left). */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BoardLayout {
  /** One rect per room slot actually laid out, in container coordinates. */
  roomRects: Rect[];
  /** Columns/rows of the laid-out grid for the requested card count. */
  columns: number;
  rows: number;
  cardWidth: number;
  cardHeight: number;
  gap: number;
  /**
   * Full board height including padding (DOM model) — the height the `.room`
   * element needs so every row is fully visible (mobile 2×2 wrap). Without
   * padding metrics this is just the grid height.
   */
  totalHeight: number;
  /** Fan step magnitudes per older-kill index — see KILL_STEP_X/Y. */
  killFanStep: Point;
}

/**
 * Explicit metrics resolved from the `.room` computed style (shared by the
 * scene and the DOM hook via src/game/board-metrics.ts). Every field is
 * optional; absent fields fall back to the viewport-relative clamp math.
 * Providing any padding switches the vertical model to the DOM flexbox one
 * (rows top-aligned at `padTop`).
 */
export interface BoardMetrics {
  /** Resolved `--card-w` in px (overrides the cardWidthFor clamp math). */
  cardW?: number;
  /** Resolved `.room` column gap in px (overrides the roomGapFor math). */
  gap?: number;
  /** `.room` padding edges in px — define the content box the flex grid lives in. */
  padTop?: number;
  padLeft?: number;
  padRight?: number;
  padBottom?: number;
}

/** Card width mirroring `clamp(132px, 19.5vw, 192px)` against the container. */
export function cardWidthFor(containerW: number): number {
  return Math.min(CARD_W_MAX, Math.max(CARD_W_MIN, containerW * CARD_W_RATIO));
}

/** Room gap mirroring `clamp(10px, 2.5vw, 22px)` against the container. */
export function roomGapFor(containerW: number): number {
  return Math.min(ROOM_GAP_MAX, Math.max(ROOM_GAP_MIN, containerW * ROOM_GAP_RATIO));
}

/**
 * Kill-stack fan offsets, one point per kill, index 0 = LAST kill (top of
 * stack, the DOM renders `[...killStack].reverse()` with index 0 at
 * `right: 0, top: 0`). Each older kill peeks out left+down by the fan step.
 * Returns `count` points; the first is always the zero offset.
 */
export function killFanOffsets(count: number): Point[] {
  return Array.from({ length: Math.max(0, Math.floor(count)) }, (_, i) => ({
    // Index 0 is a plain zero (avoid -0 from 0 * -40).
    x: i === 0 ? 0 : -KILL_STEP_X * i,
    y: KILL_STEP_Y * i,
  }));
}

/**
 * Compute the room-card layout for a container of the given size.
 *
 * @param containerW container (canvas box / `.room`) width in px
 * @param containerH container (canvas box / `.room`) height in px
 * @param roomCardCount number of room cards to lay out (0–4); defaults to a
 *   full 4-card board. Rows with fewer cards than the wrap column count are
 *   centered horizontally, mirroring `.room`'s `justify-content: center`.
 * @param metrics explicit DOM-resolved metrics (see {@link BoardMetrics});
 *   with padding the layout mirrors the DOM room exactly (top-aligned rows
 *   inside the padded content box); without it, the legacy canvas model
 *   (viewport-ratio clamps, vertically centered grid) applies.
 */
export function computeBoardLayout(
  containerW: number,
  containerH: number,
  roomCardCount: number = MAX_ROOM_CARDS,
  metrics: BoardMetrics = {},
): BoardLayout {
  const cardWidth = Math.max(1, metrics.cardW ?? cardWidthFor(containerW));
  const cardHeight = cardWidth * CARD_ASPECT;
  const gap = Math.max(0, metrics.gap ?? roomGapFor(containerW));
  const padTop = Math.max(0, metrics.padTop ?? 0);
  const padLeft = Math.max(0, metrics.padLeft ?? 0);
  const padRight = Math.max(0, metrics.padRight ?? 0);
  const padBottom = Math.max(0, metrics.padBottom ?? 0);
  const count = Math.min(MAX_ROOM_CARDS, Math.max(0, Math.floor(roomCardCount)));

  // The content box the flex grid actually lives in (zero when no padding is
  // modeled — identical to the legacy container-only behavior).
  const contentW = Math.max(0, containerW - padLeft - padRight);

  // Fixed wrap rule: does a full 4-card row fit in the content box?
  const fitsOneRow = MAX_ROOM_CARDS * cardWidth + (MAX_ROOM_CARDS - 1) * gap <= contentW;
  const columns = fitsOneRow ? Math.max(1, count) : 2;
  const rows = Math.ceil(count / columns);

  const gridH = rows > 0 ? rows * cardHeight + (rows - 1) * gap : 0;
  // Vertical model: with padding metrics, mirror the DOM — flex rows start at
  // the top padding edge. Without padding (legacy canvas-only signature) the
  // grid block is centered vertically in the container.
  const domModel = metrics.padTop !== undefined || metrics.padBottom !== undefined;
  const originY = domModel ? padTop : Math.max(0, (containerH - gridH) / 2);
  const totalHeight = domModel ? padTop + gridH + padBottom : gridH;

  const roomRects: Rect[] = [];
  for (let row = 0; row < rows; row++) {
    const inRow = Math.min(count - row * columns, columns);
    const rowW = inRow * cardWidth + (inRow - 1) * gap;
    const originX = padLeft + Math.max(0, (contentW - rowW) / 2);
    for (let col = 0; col < inRow; col++) {
      roomRects.push({
        x: originX + col * (cardWidth + gap),
        y: originY + row * (cardHeight + gap),
        width: cardWidth,
        height: cardHeight,
      });
    }
  }

  return {
    roomRects,
    columns,
    rows,
    cardWidth,
    cardHeight,
    gap,
    totalHeight,
    killFanStep: { x: KILL_STEP_X, y: KILL_STEP_Y },
  };
}
