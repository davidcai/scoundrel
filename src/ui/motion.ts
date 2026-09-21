/**
 * Phase 1a motion baseline — WAAPI/FLIP choreography for the play screen.
 *
 * Design language: a modern-RPG card table. Every movement beat is 120–350ms,
 * eased like a physical object (cards travel, they never teleport), and the
 * whole layer is disposable: ghosts are pointer-transparent + aria-hidden
 * stand-ins in a fixed overlay, and `cancelAll` restores the DOM to the
 * reconciled store state in one synchronous sweep — rapid successive actions
 * are the common case, not the exception.
 *
 * React-free by design: the director consumes store snapshots and DOM nodes
 * only. `use-motion-director.ts` owns the subscription wiring, and the
 * engine/store are strictly read-only here.
 */

import { cardKind, type CardId, type GameResult, type GameState } from '../engine';
import { loadSettings } from '../store/settings';

// ── Capability & preference ───────────────────────────────────────────────

/** True when the Web Animations API is usable (jsdom has no `animate`). */
function canAnimate(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof Element !== 'undefined' &&
    typeof Element.prototype.animate === 'function'
  );
}

/**
 * Read fresh at every event: the persisted setting is not reactive store
 * state, and the OS-level media query must win whenever it asks for calm.
 */
export function prefersReducedMotion(): boolean {
  if (loadSettings().reducedMotion) return true;
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ── Motion tokens ─────────────────────────────────────────────────────────

/** Beat durations (ms). Everything stays inside the 120–350ms envelope. */
const DUR = {
  deal: 300,
  dealStagger: 70,
  flip: 260,
  flight: 340,
  sweep: 280,
  shake: 150,
  flash: 300,
  pulse: 350,
  dissolve: 260,
  rewind: 240,
  dip: 200,
  quietFade: 180,
  reducedFade: 120,
} as const;

/** Easings: settle = fast launch + long glide; exit = accelerate away. */
const EASE = {
  settle: 'cubic-bezier(0.22, 1, 0.36, 1)',
  travel: 'cubic-bezier(0.4, 0, 0.2, 1)',
  exit: 'cubic-bezier(0.5, 0, 0.75, 0.4)',
  pop: 'cubic-bezier(0.34, 1.3, 0.64, 1)',
} as const;

// ── Registries & the cancellation sweep ───────────────────────────────────

const liveAnims = new Set<Animation>();
const hiddenEls = new Set<HTMLElement>();
const ghostEls = new Set<HTMLElement>();

/** Bumped by every cancelAll: stale settle callbacks must not restore state. */
let sweepGen = 0;

/** Register an animation so cancellation sweeps can find it; returns it. */
function trackAnim(anim: Animation, onSettled?: () => void): Animation {
  liveAnims.add(anim);
  const done = (): void => {
    liveAnims.delete(anim);
    onSettled?.();
  };
  // A canceled animation rejects `finished`; settle must run either way.
  anim.finished.then(done, done);
  return anim;
}

function hideReal(el: HTMLElement): void {
  el.style.setProperty('opacity', '0');
  hiddenEls.add(el);
}

function restoreReal(el: HTMLElement): void {
  if (!hiddenEls.delete(el)) return;
  el.style.removeProperty('opacity');
}

/**
 * Motion policy, in one function: cancel every in-flight animation we own,
 * restore every stand-in-hidden element, sweep the ghost layer, and cancel
 * any strays (CSS transitions included) under `root` before reconciliation.
 */
export function cancelAll(root?: Element | null): void {
  sweepGen += 1;
  const anims = [...liveAnims];
  liveAnims.clear();
  for (const anim of anims) {
    try {
      anim.cancel();
    } catch {
      /* node already detached */
    }
  }
  for (const el of hiddenEls) el.style.removeProperty('opacity');
  hiddenEls.clear();
  if (ghostLayer !== null && ghostLayer.isConnected) ghostLayer.replaceChildren();
  ghostEls.clear();
  if (root !== null && root !== undefined && canAnimate()) {
    try {
      for (const anim of root.getAnimations({ subtree: true })) {
        try {
          anim.cancel();
        } catch {
          /* already gone */
        }
      }
    } catch {
      /* getAnimations({ subtree }) unsupported */
    }
  }
}

// ── Ghost layer ───────────────────────────────────────────────────────────

let ghostLayer: HTMLDivElement | null = null;

function ensureGhostLayer(): HTMLDivElement | null {
  if (!canAnimate() || typeof document === 'undefined') return null;
  if (ghostLayer !== null && ghostLayer.isConnected) return ghostLayer;
  const layer = document.createElement('div');
  layer.className = 'fx-layer';
  layer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layer);
  ghostLayer = layer;
  return layer;
}

/**
 * A fixed-position stand-in that owns N tracked animations and removes
 * itself from the DOM once they all settle (finish or cancel).
 */
class GhostFX {
  readonly el: HTMLElement;
  private remaining = 0;
  private destroyed = false;
  private readonly gen = sweepGen;

  constructor(layer: HTMLElement, className: string, rect: DOMRect) {
    const el = document.createElement('div');
    el.className = className;
    el.style.left = `${rect.left}px`;
    el.style.top = `${rect.top}px`;
    el.style.width = `${rect.width}px`;
    el.style.height = `${rect.height}px`;
    layer.appendChild(el);
    this.el = el;
    ghostEls.add(el);
  }

  animate(
    el: HTMLElement,
    keyframes: Keyframe[],
    options: KeyframeAnimationOptions,
    onSettled?: () => void,
  ): void {
    if (this.destroyed) return;
    this.remaining += 1;
    trackAnim(el.animate(keyframes, options), () => this.settle(onSettled));
  }

  destroy(): void {
    this.destroyed = true;
    this.el.remove();
    ghostEls.delete(this.el);
  }

  private settle(onSettled?: () => void): void {
    this.remaining -= 1;
    // A stale ghost was already swept by cancelAll — skip its side effects.
    if (this.gen === sweepGen && onSettled !== undefined) onSettled();
    if (this.remaining <= 0) this.destroy();
  }
}

/** Clone the visible face of a card button (artwork `<img>` or fallback). */
function cloneCardFace(source: Element): HTMLElement | null {
  const visual = source.querySelector('img, .card-fallback');
  if (visual === null) return null;
  const clone = visual.cloneNode(true);
  if (!(clone instanceof HTMLElement)) return null;
  if (clone instanceof HTMLImageElement) {
    clone.alt = '';
    clone.draggable = false;
  }
  return clone;
}

/** Position-only ghost carrying a snapshot of a card's face. */
function spawnFaceGhost(source: Element, rect: DOMRect): GhostFX | null {
  const layer = ensureGhostLayer();
  if (layer === null) return null;
  const ghost = new GhostFX(layer, 'fx-ghost', rect);
  const face = cloneCardFace(source);
  if (face !== null) ghost.el.appendChild(face);
  return ghost;
}

/**
 * Deal ghost: the card flies in from the deck edge showing a CSS-styled back,
 * which turns over (rotateY) to reveal the face mid-flight. The real button
 * is revealed via `onReveal` the moment the slide settles.
 */
function spawnDealGhost(
  source: Element,
  rect: DOMRect,
  delayMs: number,
  carried: boolean,
  dx: number,
  onReveal: () => void,
): GhostFX | null {
  const layer = ensureGhostLayer();
  if (layer === null) return null;
  const ghost = new GhostFX(layer, 'fx-ghost fx-ghost-deal', rect);
  const flipper = document.createElement('div');
  flipper.className = 'fx-flipper';
  const back = document.createElement('div');
  back.className = 'fx-card-back';
  const faceHost = document.createElement('div');
  faceHost.className = 'fx-card-face';
  const face = cloneCardFace(source);
  if (face !== null) faceHost.appendChild(face);
  flipper.append(back, faceHost);
  ghost.el.appendChild(flipper);

  ghost.animate(
    ghost.el,
    [
      { transform: `translate3d(${dx}px, -10px, 0) rotate(4deg)`, opacity: 0 },
      { opacity: 1, offset: 0.35 },
      { transform: 'translate3d(0, 0, 0) rotate(0deg)', opacity: 1 },
    ],
    { duration: DUR.deal, delay: delayMs, easing: EASE.settle, fill: 'backwards' },
    onReveal,
  );
  ghost.animate(flipper, [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(180deg)' }], {
    duration: 250,
    delay: delayMs + 30,
    easing: 'ease-in-out',
    fill: 'backwards',
  });
  if (carried) {
    // Distinct re-entry emphasis for the card carried from the previous room.
    ghost.animate(
      faceHost,
      [
        { filter: 'brightness(1)' },
        { filter: 'brightness(1.45)', offset: 0.5 },
        { filter: 'brightness(1)' },
      ],
      { duration: 240, delay: delayMs + DUR.deal - 120, easing: 'ease-in-out' },
    );
  }
  return ghost;
}

/** Floating "+N" numeral above the HP bar (plain number — no i18n needed). */
function spawnHpFloat(root: HTMLElement, text: string, variant: 'heal' | 'wasted'): void {
  const layer = ensureGhostLayer();
  const bar = root.querySelector<HTMLElement>('.hp-bar');
  if (layer === null || bar === null) return;
  const rect = bar.getBoundingClientRect();
  const wrap = document.createElement('div');
  wrap.className = 'fx-float';
  wrap.dataset.variant = variant;
  wrap.style.left = `${rect.left + rect.width / 2}px`;
  wrap.style.top = `${rect.top - 10}px`;
  const inner = document.createElement('span');
  inner.className = 'fx-float-inner';
  inner.textContent = text;
  wrap.appendChild(inner);
  layer.appendChild(wrap);
  ghostEls.add(wrap);
  const rise = variant === 'heal' ? 32 : 16;
  const anim = inner.animate(
    [
      { transform: 'translateY(4px)', opacity: 0 },
      { transform: 'translateY(-6px)', opacity: 1, offset: 0.25 },
      { transform: `translateY(${-rise}px)`, opacity: variant === 'heal' ? 1 : 0.9, offset: 0.8 },
      { transform: `translateY(${-rise - 6}px)`, opacity: 0 },
    ],
    { duration: variant === 'heal' ? 350 : 280, easing: 'ease-out' },
  );
  trackAnim(anim, () => {
    wrap.remove();
    ghostEls.delete(wrap);
  });
}

// ── FLIP ──────────────────────────────────────────────────────────────────

export interface FlipHandle {
  el: Element;
  first: DOMRect;
}

/** FLIP step 1 — record the element's rect before a layout change. */
export function flipFirst(el: Element): FlipHandle {
  return { el, first: el.getBoundingClientRect() };
}

/** FLIP steps 2–4 — measure the new rect, invert the delta, play it to zero. */
export function flipPlay(
  handle: FlipHandle,
  duration: number = DUR.flip,
  easing: string = EASE.travel,
): Animation | null {
  if (!canAnimate()) return null;
  const lastRect = handle.el.getBoundingClientRect();
  const dx = handle.first.left - lastRect.left;
  const dy = handle.first.top - lastRect.top;
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return null;
  return handle.el.animate(
    [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
    { duration, easing },
  );
}

// ── DOM queries ───────────────────────────────────────────────────────────

/**
 * Canvas-mode contract (Phaser adoption, Phase 2): when the canvas is the
 * room's primary renderer, its container inside `.room` carries the class
 * `canvas-live` (added by PhaserBoard). Room-card pixels then come from the
 * canvas, so DOM choreography on elements living inside `.room` would fight
 * the canvas's own static sprites — such beats are classified `room` and
 * dropped, while shared chrome (HP bar, weapon zone, kill stack) keeps
 * animating. The room container itself is chrome: a nudge moves the canvas
 * and the DOM together, so nothing fights.
 */
export type FxZone = 'room' | 'chrome';

/** True when `el` lives strictly inside the room's pixel territory. */
export function isCanvasTerritory(el: Element | null): boolean {
  if (el === null) return false;
  const room = el.closest('.room');
  return room !== null && room !== el;
}

/** One planned unit of choreography, tagged by the surface it draws on. */
interface FxBeat {
  zone: FxZone;
  run: () => void;
}

function roomButton(root: ParentNode, id: CardId): HTMLElement | null {
  return root.querySelector<HTMLElement>(`.room [data-card-id="${id}"]`);
}

function roomWrapper(root: ParentNode, id: CardId): Element | null {
  return roomButton(root, id)?.closest('.tooltip-wrap') ?? null;
}

function killButton(root: ParentNode, id: CardId): HTMLElement | null {
  return root.querySelector<HTMLElement>(`.kill-stack [data-card-id="${id}"]`);
}

function killWrapper(root: ParentNode, id: CardId): Element | null {
  return killButton(root, id)?.closest('.kill-card') ?? null;
}

/** Offset pointing from a reverted card's origin zone back toward its slot. */
function originOffset(root: HTMLElement, id: CardId, btn: Element): [number, number] {
  const kind = cardKind(id);
  const zone =
    kind === 'monster'
      ? root.querySelector('.kill-side')
      : kind === 'weapon'
        ? root.querySelector('.weapon-side')
        : null;
  if (zone === null) return [0, 48];
  const zr = zone.getBoundingClientRect();
  const br = btn.getBoundingClientRect();
  const dx = zr.left + zr.width / 2 - (br.left + br.width / 2);
  const dy = zr.top + zr.height / 2 - (br.top + br.height / 2);
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return [0, 48];
  const scale = Math.min(56, dist) / dist;
  return [dx * scale, dy * scale];
}

// ── FX beats ──────────────────────────────────────────────────────────────

/** Red damage flash: a glow ring + brightness pulse on the HP bar (DOM). */
function flashHpBar(root: HTMLElement): void {
  const bar = root.querySelector<HTMLElement>('.hp-bar');
  bar?.animate(
    [
      { boxShadow: '0 0 0 0 rgba(224, 86, 79, 0)', filter: 'brightness(1)' },
      {
        boxShadow: '0 0 0 5px rgba(224, 86, 79, 0.5)',
        filter: 'brightness(1.35)',
        offset: 0.35,
      },
      { boxShadow: '0 0 0 0 rgba(224, 86, 79, 0)', filter: 'brightness(1)' },
    ],
    { duration: DUR.flash, easing: 'ease-out' },
  );
}

// ── Motion director ───────────────────────────────────────────────────────

/** The slice of store state the director reacts to. */
export interface FxSnapshot {
  game: GameState | null;
  lastResult: GameResult | null;
  fxSeq: number;
  /** The live run was restored from storage — its mount reconciles silently. */
  runResumed: boolean;
}

interface PendingPlan {
  run: () => boolean;
  retries: number;
}

/**
 * Turns `(prevState, state, lastResult)` diffs into choreography.
 *
 * Lifecycle per beat: `onStoreChange` measures the old DOM and clones
 * departing cards into ghosts, then parks a plan; `onCommit` (layout effect)
 * executes it synchronously against the reconciled DOM before paint, so
 * nothing ever flashes at its destination.
 */
export class MotionDirector {
  private readonly getRoot: () => HTMLElement | null;
  private pending: PendingPlan | null = null;
  private rafId = 0;

  constructor(getRoot: () => HTMLElement | null) {
    this.getRoot = getRoot;
  }

  /** Store notification. Skips no-op beats; cancels in-flight FX first. */
  onStoreChange(state: FxSnapshot, prev: FxSnapshot): void {
    const fxChanged = state.fxSeq !== prev.fxSeq;
    const nullityChanged = (prev.game === null) !== (state.game === null);
    // act() always writes a non-null result, so a game swap with a null
    // result can only be startRun (e.g. a new seeded URL) over a live run.
    const swappedRun =
      state.game !== null &&
      prev.game !== null &&
      state.game !== prev.game &&
      state.lastResult === null;
    if (!fxChanged && !nullityChanged && !swappedRun) return;

    this.abandonPending();
    const root = this.getRoot();
    cancelAll(root);
    if (root === null || state.game === null) return;
    // Resume-from-save: hydrate() flags restored runs so their null → game
    // transition reconciles silently. runResumed stays true for the run's
    // lifetime — only the transition itself is skipped, never later actions.
    const nullToGame = prev.game === null || swappedRun;
    if (nullToGame && state.runResumed) return;
    const mountDeal = nullToGame && !state.runResumed;
    if (state.game.phase !== 'playing') return; // terminal: the board unmounts
    if (!canAnimate()) return;

    this.planChoreography(root, state.game, prev.game, state.lastResult, mountDeal);
  }

  /** Called after every React commit (layout effect) — runs a pending plan. */
  onCommit(): void {
    this.runPending();
  }

  /** The board was already rendered when this screen mounted (deep link). */
  onMounted(game: GameState | null): void {
    if (game === null || game.phase !== 'playing' || game.room.length === 0) return;
    if (!canAnimate()) return;
    const root = this.getRoot();
    if (root === null) return;
    this.planChoreography(root, game, null, null, true);
    this.runPending();
  }

  dispose(): void {
    this.abandonPending();
    cancelAll(this.getRoot());
  }

  private abandonPending(): void {
    this.pending = null;
    if (this.rafId !== 0) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  private schedule(run: () => boolean): void {
    this.abandonPending();
    this.pending = { run, retries: 0 };
    this.rafId = requestAnimationFrame(() => {
      this.rafId = 0;
      this.runPending();
    });
  }

  private runPending(): void {
    const plan = this.pending;
    if (plan === null) return;
    this.pending = null;
    if (this.rafId !== 0) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
    if (plan.run()) return;
    // Fallback path only: the commit had not landed yet — try two more frames.
    if (plan.retries >= 2) return;
    this.pending = { run: plan.run, retries: plan.retries + 1 };
    this.rafId = requestAnimationFrame(() => {
      this.rafId = 0;
      this.runPending();
    });
  }

  // ── Plan construction ───────────────────────────────────────────────────

  private planChoreography(
    root: HTMLElement,
    game: GameState,
    prevGame: GameState | null,
    result: GameResult | null,
    mountDeal: boolean,
  ): void {
    const prevRoom = prevGame?.room ?? [];
    const nextRoom = game.room;
    const arrived = nextRoom.filter((id) => !prevRoom.includes(id));
    const survivors = nextRoom.filter((id) => prevRoom.includes(id));

    // Canvas-mode contract (see `isCanvasTerritory`): when the canvas owns
    // the room visuals, beats tagged `room` are dropped at plan level so
    // DOM choreography never fights the canvas's sprites.
    const canvasOwnsRoom = root.querySelector('.phaser-board.canvas-live') !== null;

    if (prefersReducedMotion()) {
      if (canvasOwnsRoom) return; // arrivals are the canvas's pixels now
      // Reduced motion: one ≤120ms opacity fade for arrivals, nothing else.
      const ids = mountDeal ? nextRoom : arrived;
      if (ids.length === 0) return;
      this.schedule(() => {
        for (const id of ids) {
          roomButton(root, id)?.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration: DUR.reducedFade,
            easing: 'ease-out',
            fill: 'backwards',
          });
        }
        return true;
      });
      return;
    }

    // ── Pre-commit capture: the old DOM is still mounted at this point. ──
    const firsts = new Map<Element, DOMRect>();
    const capture = (el: Element | null): void => {
      if (el !== null && !firsts.has(el)) firsts.set(el, el.getBoundingClientRect());
    };
    if (!canvasOwnsRoom) {
      // Survivor FLIPs re-center room cards — canvas territory in canvas mode.
      for (const id of survivors) capture(roomWrapper(root, id));
    }
    const prevKills = new Set<CardId>(prevGame?.killStack ?? []);
    for (const id of game.killStack) {
      if (prevKills.has(id)) capture(killWrapper(root, id));
    }

    interface Flight {
      ghost: GhostFX;
      from: DOMRect;
    }
    const spawnRoomGhost = (id: CardId): Flight | null => {
      // No DOM ghost for canvas-owned pixels: a spawned-but-never-animated
      // ghost would linger in the fx layer until the next sweep.
      if (canvasOwnsRoom) return null;
      const btn = roomButton(root, id);
      if (btn === null) return null;
      const from = btn.getBoundingClientRect();
      const ghost = spawnFaceGhost(btn, from);
      return ghost === null ? null : { ghost, from };
    };

    const steps: FxBeat[] = [];
    const push = (zone: FxZone, run: () => void): void => {
      steps.push({ zone, run });
    };

    if (mountDeal) {
      this.pushDealStep(push, root, nextRoom, game.carriedCardId, 0);
    } else {
      switch (result?.type) {
        case 'RoomDealt': {
          this.pushDealStep(push, root, arrived, null, 0);
          const carried = result.carriedFrom;
          if (carried !== null && survivors.includes(carried)) {
            // The carried card stayed mounted — travel it (FLIP) and pulse.
            push('room', () => {
              roomWrapper(root, carried)?.animate(
                [
                  { boxShadow: '0 0 0 0 rgba(240, 193, 105, 0)' },
                  { boxShadow: '0 0 22px 3px rgba(240, 193, 105, 0.45)', offset: 0.4 },
                  { boxShadow: '0 0 0 0 rgba(240, 193, 105, 0)' },
                ],
                { duration: DUR.pulse, easing: 'ease-out' },
              );
            });
          }
          break;
        }
        case 'RanAway': {
          const leaving = prevRoom
            .filter((id) => !nextRoom.includes(id))
            .flatMap((id): Flight[] => {
              const flight = spawnRoomGhost(id);
              return flight === null ? [] : [flight];
            });
          push('room', () => {
            const room = root.querySelector('.room');
            const roomRight =
              room !== null ? room.getBoundingClientRect().right : window.innerWidth;
            leaving.forEach((flight, i) => {
              const dx = Math.max(160, roomRight + 40 - flight.from.left);
              flight.ghost.animate(
                flight.ghost.el,
                [
                  { transform: 'translate3d(0, 0, 0) rotate(0deg)', opacity: 1 },
                  { transform: `translate3d(${dx}px, 26px, 0) rotate(4deg)`, opacity: 0 },
                ],
                { duration: DUR.sweep, delay: i * 45, easing: EASE.exit, fill: 'backwards' },
              );
            });
          });
          this.pushDealStep(push, root, arrived, null, 140);
          break;
        }
        case 'MonsterDefeated': {
          const cardId = result.cardId;
          const flight = spawnRoomGhost(cardId);
          push('room', () => {
            if (flight === null) return;
            const target = killButton(root, cardId);
            if (target === null) {
              // Barehanded kill: no stack slot — dissolve where it stood.
              flight.ghost.animate(
                flight.ghost.el,
                [
                  { transform: 'scale(1)', opacity: 1 },
                  { transform: 'scale(1.08)', opacity: 0 },
                ],
                { duration: DUR.dissolve, easing: EASE.exit },
              );
              return;
            }
            hideReal(target);
            const to = target.getBoundingClientRect();
            const dx = to.left - flight.from.left;
            const dy = to.top - flight.from.top;
            // Crossfade: the real card fades in as the ghost's final fade-out
            // lands, so the monster never blinks at the stack.
            target.animate([{ opacity: 0 }, { opacity: 1 }], {
              duration: 70,
              delay: DUR.flight - 70,
              easing: 'ease-out',
            });
            // Fly (with a slight arc) into the new kill-stack slot, scaling
            // down to the stack's 0.85 size, then reveal the real card.
            flight.ghost.animate(
              flight.ghost.el,
              [
                { transform: 'translate3d(0, 0, 0) scale(1)' },
                {
                  transform: `translate3d(${dx * 0.5}px, ${dy * 0.5 - 26}px, 0) scale(0.93)`,
                  offset: 0.55,
                },
                { transform: `translate3d(${dx}px, ${dy}px, 0) scale(0.85)` },
              ],
              { duration: DUR.flight, easing: EASE.travel, fill: 'both' },
              () => restoreReal(target),
            );
            flight.ghost.animate(
              flight.ghost.el,
              [{ opacity: 1 }, { opacity: 1, offset: 0.86 }, { opacity: 0 }],
              { duration: DUR.flight, easing: 'ease-out' },
            );
          });
          if (result.damage > 0) push('chrome', () => flashHpBar(root));
          break;
        }
        case 'PotionQuaffed': {
          const dissolve = spawnRoomGhost(result.cardId);
          push('room', () => {
            dissolve?.ghost.animate(
              dissolve.ghost.el,
              [
                { transform: 'scale(1)', opacity: 1 },
                { transform: 'scale(1.12)', opacity: 0 },
              ],
              { duration: DUR.dissolve, easing: EASE.exit },
            );
          });
          push('chrome', () => {
            spawnHpFloat(
              root,
              result.wasted ? '0' : `+${result.healed}`,
              result.wasted ? 'wasted' : 'heal',
            );
          });
          break;
        }
        case 'WeaponEquipped': {
          // The old weapon leads the discard sweep, its kill pile trails it.
          const discards: Flight[] = [];
          const oldWeapon = result.discardedWeaponId;
          if (oldWeapon !== null) {
            const btn = root.querySelector<HTMLElement>(
              `.weapon-side [data-card-id="${oldWeapon}"]`,
            );
            if (btn !== null) {
              const from = btn.getBoundingClientRect();
              const ghost = spawnFaceGhost(btn, from);
              if (ghost !== null) discards.push({ ghost, from });
            }
          }
          const killFlights = result.discardedMonsterIds.flatMap((id): Flight[] => {
            const btn = killButton(root, id);
            if (btn === null) return [];
            const from = btn.getBoundingClientRect();
            const ghost = spawnFaceGhost(btn, from);
            return ghost === null ? [] : [{ ghost, from }];
          });
          push('chrome', () => {
            const weaponBtn = root.querySelector<HTMLElement>(
              `.weapon-side [data-card-id="${result.cardId}"]`,
            );
            // Settle: drop-in with a gentle overshoot + one gold ring pulse.
            weaponBtn?.animate(
              [
                { transform: 'translateY(-14px) scale(1.05)', opacity: 0.4 },
                { transform: 'translateY(0) scale(1)', opacity: 1 },
              ],
              { duration: 280, easing: EASE.pop, fill: 'backwards' },
            );
            weaponBtn?.animate(
              [
                { boxShadow: '0 0 0 0 rgba(240, 193, 105, 0)' },
                { boxShadow: '0 0 20px 4px rgba(240, 193, 105, 0.5)', offset: 0.45 },
                { boxShadow: '0 0 0 0 rgba(240, 193, 105, 0)' },
              ],
              { duration: DUR.pulse, delay: 140, easing: 'ease-out' },
            );
            const lead = discards[0];
            if (lead !== undefined) {
              lead.ghost.animate(
                lead.ghost.el,
                [
                  { transform: 'translate3d(0, 0, 0) rotate(0deg)', opacity: 1 },
                  { transform: 'translate3d(-150px, 40px, 0) rotate(-7deg)', opacity: 0 },
                ],
                { duration: DUR.sweep, easing: EASE.exit },
              );
            }
            const target = lead?.from;
            killFlights.forEach((flight, i) => {
              const tx =
                target !== undefined
                  ? target.left + target.width / 2 - (flight.from.left + flight.from.width / 2)
                  : -160;
              const ty =
                target !== undefined
                  ? target.top + target.height / 2 - (flight.from.top + flight.from.height / 2)
                  : 30;
              flight.ghost.animate(
                flight.ghost.el,
                [
                  { transform: 'translate3d(0, 0, 0) rotate(0deg)', opacity: 1 },
                  {
                    transform: `translate3d(${tx}px, ${ty}px, 0) rotate(-4deg) scale(0.92)`,
                    opacity: 0,
                  },
                ],
                { duration: 320, delay: 60 + i * 50, easing: EASE.exit, fill: 'backwards' },
              );
            });
          });
          break;
        }
        case 'UndoDone': {
          // Quiet rewind: cards slide back in from their origin zone's
          // direction; reverted kill-stack nodes FLIP back via `firsts`.
          // Split by zone: the card returns are room pixels, the weapon-side
          // fades are shared chrome and survive canvas mode.
          push('room', () => {
            arrived.forEach((id, i) => {
              const btn = roomButton(root, id);
              if (btn === null) return;
              const [dx, dy] = originOffset(root, id, btn);
              btn.animate(
                [
                  { transform: `translate(${dx}px, ${dy}px)`, opacity: 0 },
                  { transform: 'translate(0, 0)', opacity: 1 },
                ],
                { duration: DUR.rewind, delay: i * 40, easing: EASE.travel, fill: 'backwards' },
              );
            });
          });
          push('chrome', () => {
            const prevWeapon = prevGame?.weapon ?? null;
            if (prevWeapon !== game.weapon) {
              if (prevWeapon === null) {
                const next = game.weapon ?? '';
                root
                  .querySelector(`.weapon-side [data-card-id="${next}"]`)
                  ?.animate([{ opacity: 0 }, { opacity: 1 }], {
                    duration: DUR.quietFade,
                    fill: 'backwards',
                  });
              } else if (game.weapon !== null) {
                root
                  .querySelector('.weapon-side [data-card-id]')
                  ?.animate([{ opacity: 1 }, { opacity: 0.35, offset: 0.5 }, { opacity: 1 }], {
                    duration: DUR.dip,
                    easing: 'ease-in-out',
                  });
              }
            }
          });
          if (prevGame !== null && prevGame.weapon !== null && game.weapon === null) {
            const btn = root.querySelector<HTMLElement>(
              `.weapon-side [data-card-id="${prevGame.weapon}"]`,
            );
            if (btn !== null) {
              const from = btn.getBoundingClientRect();
              const ghost = spawnFaceGhost(btn, from);
              push('chrome', () => {
                ghost?.animate(ghost.el, [{ opacity: 1 }, { opacity: 0 }], {
                  duration: DUR.quietFade,
                  easing: 'ease-out',
                });
              });
            }
          }
          break;
        }
        case 'RunAwayBlocked':
        case 'InvalidAction': {
          // Container-level nudge, not per-card pixels: in canvas mode the
          // canvas shakes along with the room, so nothing fights. Chrome.
          push('chrome', () => {
            root
              .querySelector('.room')
              ?.animate(
                [
                  { transform: 'translateX(0)' },
                  { transform: 'translateX(-3px)', offset: 0.2 },
                  { transform: 'translateX(3px)', offset: 0.45 },
                  { transform: 'translateX(-2px)', offset: 0.7 },
                  { transform: 'translateX(0)' },
                ],
                { duration: DUR.shake, easing: 'linear' },
              );
          });
          break;
        }
        default:
          // GameWon/GameLost carry no card to choreograph — the board
          // unmounts into the GameOver screen (sequencing is a later phase).
          break;
      }
    }

    // Shared: FLIP everything that persisted across the reconciliation
    // (surviving room cards re-centering, kill-stack cards making room).
    // In canvas mode `firsts` only holds kill-stack wrappers — chrome.
    if (firsts.size > 0) {
      push('chrome', () => {
        for (const [el, first] of firsts) {
          if (el.isConnected) flipPlay({ el, first });
        }
      });
    }

    // Plan-level filter (canvas-mode contract): room-pixel beats are dropped
    // wholesale so the DOM never choreographs over live canvas sprites.
    const live = canvasOwnsRoom ? steps.filter((beat) => beat.zone === 'chrome') : steps;
    if (live.length === 0) return;
    // Room buttons may not exist when the canvas owns the room — chrome
    // beats must not be gated on DOM cards that are no longer rendered.
    const ready = (): boolean =>
      canvasOwnsRoom || nextRoom.every((id) => roomButton(root, id) !== null);
    this.schedule(() => {
      if (!ready()) return false;
      for (const beat of live) beat.run();
      return true;
    });
  }

  /**
   * Staggered deal-in: each card flies from the deck edge (the room's
   * trailing edge) while a card-back flips over to reveal the face. The
   * carried card re-enters last, with a brightness emphasis.
   */
  private pushDealStep(
    push: (zone: FxZone, run: () => void) => void,
    root: HTMLElement,
    ids: readonly CardId[],
    carriedId: CardId | null,
    baseDelay: number,
  ): void {
    if (ids.length === 0) return;
    push('room', () => {
      const room = root.querySelector('.room');
      if (room === null) return;
      const roomRight = room.getBoundingClientRect().right;
      const ordered =
        carriedId !== null && ids.includes(carriedId)
          ? [...ids.filter((id) => id !== carriedId), carriedId]
          : [...ids];
      ordered.forEach((id, i) => {
        const btn = roomButton(root, id);
        if (btn === null) return;
        const delay = baseDelay + i * DUR.dealStagger;
        const rect = btn.getBoundingClientRect();
        const dx = Math.max(120, roomRight + 28 - rect.left);
        const ghost = spawnDealGhost(btn, rect, delay, id === carriedId, dx, () =>
          restoreReal(btn),
        );
        if (ghost === null) {
          // No ghost layer (defensive): slide the real card in directly.
          btn.animate(
            [
              { transform: `translate3d(${dx}px, -8px, 0) rotate(3deg)`, opacity: 0 },
              { transform: 'translate3d(0, 0, 0) rotate(0deg)', opacity: 1 },
            ],
            { duration: DUR.deal, delay, easing: EASE.settle, fill: 'backwards' },
          );
          return;
        }
        hideReal(btn);
      });
    });
  }
}
