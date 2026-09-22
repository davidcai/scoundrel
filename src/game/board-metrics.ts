import type { BoardMetrics } from './board-layout';

/**
 * DOM-derived board metrics — THE single shared metrics path for the Phaser
 * scene (board-scene.ts) and the DOM hit-layer hook (use-board-layout.ts).
 * Both consumers read the SAME `.room` element through this module, so their
 * geometry cannot drift (phaser-adoption-plan Phase 2: "the scene must derive
 * metrics the same way the DOM does").
 *
 * The DOM reader is intentionally isolated from the pure layout function:
 * board-layout.ts stays free of DOM imports (node-testable), while this module
 * is only ever called in-browser.
 *
 * `--card-w` is a registered `@property` (styles.css, `syntax: '<length>'`),
 * so its computed value resolves the `clamp(..., vw, ...)` to a px length —
 * exactly what the flex cards render at. Fallback for engines without
 * `@property`: measure a room card button.
 */
export function readRoomMetrics(room: HTMLElement | null): BoardMetrics {
  if (room === null) return {};
  const cs = window.getComputedStyle(room);
  return {
    cardW: cardWidthFrom(room, cs) ?? undefined,
    gap: px(cs.columnGap) ?? px(cs.rowGap) ?? undefined,
    padTop: px(cs.paddingTop) ?? undefined,
    padLeft: px(cs.paddingLeft) ?? undefined,
    padRight: px(cs.paddingRight) ?? undefined,
    padBottom: px(cs.paddingBottom) ?? undefined,
  };
}

/** Parses a computed style value that must be a px length, else null. */
function px(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed.endsWith('px')) return null;
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function cardWidthFrom(room: HTMLElement, cs: CSSStyleDeclaration): number | null {
  const fromVar = px(cs.getPropertyValue('--card-w'));
  if (fromVar !== null) return fromVar;
  // @property unsupported: measure a room card. In fallback (non-canvas-live)
  // mode that width IS the resolved --card-w; in canvas-live mode the buttons
  // are sized from the previous layout, so the read stays self-consistent.
  const card = room.querySelector<HTMLElement>('button.card');
  return card !== null ? px(window.getComputedStyle(card).width) : null;
}
