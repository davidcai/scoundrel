/**
 * Client ↔ game coordinate mapping across the Scale.FIT transform.
 *
 * FIT scales the canvas via CSS while the backbuffer stays at the config
 * resolution, so every consumer that moves between DOM space and canvas space —
 * tooltip cursor syncing, hit tests, the Playwright input path — must go
 * through one shared transform.
 *
 * Phaser's ScaleManager exposes the primitives `transformX(pageX)` /
 * `transformY(pageY)` (canvasBounds-aware, so CSS-transformed parents and page
 * scroll are already accounted for); this module composes them into the
 * combined `transformXY(pageX, pageY, out)` helper named in the plan.
 */

export interface XY {
  x: number;
  y: number;
}

/**
 * Structural subset of `Phaser.Scale.ScaleManager` used here — declared
 * structurally so this module stays Phaser-free and jsdom-testable.
 */
export interface GameScale {
  transformX(pageX: number): number;
  transformY(pageY: number): number;
  canvasBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  displayScale: { x: number; y: number };
}

/** Mutates-and-returns `out` (Phaser's out-param convention) to avoid allocs in move handlers. */
export function transformXY(
  scale: GameScale,
  pageX: number,
  pageY: number,
  out: XY = { x: 0, y: 0 },
): XY {
  out.x = scale.transformX(pageX);
  out.y = scale.transformY(pageY);
  return out;
}

/** Page (not client) coordinates are what the ScaleManager consumes. */
export function pageFromClient(x: number, y: number): XY {
  return {
    x: x + (window.scrollX || window.pageXOffset || 0),
    y: y + (window.scrollY || window.pageYOffset || 0),
  };
}

/** Client (viewport) coordinates → game-space point. */
export function clientToGame(
  scale: GameScale,
  clientX: number,
  clientY: number,
  out: XY = { x: 0, y: 0 },
): XY {
  const page = pageFromClient(clientX, clientY);
  return transformXY(scale, page.x, page.y, out);
}

/** Inverse mapping: game-space point → page coordinates (tooltip anchoring). */
export function gameToPage(
  scale: GameScale,
  gameX: number,
  gameY: number,
  out: XY = { x: 0, y: 0 },
): XY {
  out.x = scale.canvasBounds.x + gameX / scale.displayScale.x;
  out.y = scale.canvasBounds.y + gameY / scale.displayScale.y;
  return out;
}

/** Rectangle in game space (a card sprite's footprint), for hit tests. */
export interface GameRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function pointInRect(point: XY, rect: GameRect): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

/** Hit test: does the client point land inside the game-space rect? */
export function hitTest(
  scale: GameScale,
  rect: GameRect,
  clientX: number,
  clientY: number,
): boolean {
  return pointInRect(clientToGame(scale, clientX, clientY), rect);
}
