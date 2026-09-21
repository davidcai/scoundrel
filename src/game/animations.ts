/**
 * Named tween choreography, hand-authored timing, and the interruption policy —
 * Phaser-free so bridge/animation unit tests can drive it with a fake tween
 * clock under jsdom. The Phaser scene adapts `TweenHost` to `this.tweens.add` /
 * `this.time.delayedCall`; tests provide a fake clock.
 *
 * Interruption policy (plan §3): commands never queue behind animations. When a
 * new command arrives, the scene snaps ALL in-flight tweens to their end state
 * BEFORE choreographing the new one — `tween.stop()` does NOT write end values,
 * so every tracked tween carries a `finalize()` closure that manually writes
 * its final values (and runs its inventory side effects) before stopping.
 */

/** The tweenable property set (structural subset of Phaser sprites/text/graphics). */
export interface MotionProps {
  x: number;
  y: number;
  alpha: number;
  scaleX: number;
  scaleY: number;
  angle: number;
}

export type MotionTarget = MotionProps;

export function applyMotion(target: MotionTarget, props: Partial<MotionProps>): void {
  if (props.x !== undefined) target.x = props.x;
  if (props.y !== undefined) target.y = props.y;
  if (props.alpha !== undefined) target.alpha = props.alpha;
  if (props.scaleX !== undefined) target.scaleX = props.scaleX;
  if (props.scaleY !== undefined) target.scaleY = props.scaleY;
  if (props.angle !== undefined) target.angle = props.angle;
}

/** One phase of motion. End values are authoritative: snapping writes them. */
export interface TweenSpec {
  target: MotionTarget;
  /** Explicit start values, written before the tween starts (deterministic re-runs). */
  from?: Partial<MotionProps>;
  to: Partial<MotionProps>;
  durationMs: number;
  /** Phaser ease string, e.g. 'Back.easeOut'; default 'Linear'. */
  ease?: string;
  delayMs?: number;
  /** Play to `to` then back to `from` — snapping mid-yoyo writes `from` (the rest state). */
  yoyo?: boolean;
  repeat?: number;
  /** Per-frame visual hook (e.g. the HP readout follows the draining bar). */
  onUpdate?: (target: MotionTarget) => void;
  /** Inventory side effect (destroy/detach); runs on natural completion OR snap, once. */
  onSettle?: () => void;
}

/** Seam over the scene's tween/timer systems (adapted in the scene, faked in tests). */
export interface TweenHost {
  add(spec: TweenSpec): { stop(): void };
  delayedCall(ms: number, cb: () => void): { stop(): void };
}

/** A tracked in-flight tween: snapping writes end values, then stops the tween. */
export interface TrackedTween {
  finalize(): void;
  stop(): void;
}

/** Registry of in-flight tweens for the interruption policy's snap step. */
export class TweenTracker {
  private active = new Set<TrackedTween>();

  track(tween: TrackedTween): void {
    this.active.add(tween);
  }

  /** Snap ALL in-flight tweens to their end state (manual final-value writes). */
  snapAll(): void {
    for (const tween of [...this.active]) tween.finalize();
    this.active.clear();
  }

  get size(): number {
    return this.active.size;
  }
}

function once(fn?: () => void): () => void {
  let called = false;
  return () => {
    if (called) return;
    called = true;
    fn?.();
  };
}

/**
 * Plays a choreography: applies `from` values, starts every tween through the
 * host, tracks each for snapping, and fires `onComplete` exactly once — when
 * the longest tween settles, or immediately if the choreography is snapped.
 * `onSettle` side effects are once-guarded across natural completion and snap.
 */
export function runChoreography(
  host: TweenHost,
  tracker: TweenTracker,
  specs: readonly TweenSpec[],
  onComplete?: () => void,
): void {
  if (specs.length === 0) {
    onComplete?.();
    return;
  }
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    onComplete?.();
  };

  let latest = 0;
  for (const spec of specs) {
    const settle = once(spec.onSettle);
    if (spec.from !== undefined) applyMotion(spec.target, spec.from);
    const handle = host.add({ ...spec, onSettle: settle });
    tracker.track({
      finalize() {
        applyMotion(spec.target, spec.yoyo === true && spec.from ? spec.from : spec.to);
        settle();
        handle.stop();
      },
      stop: handle.stop,
    });
    const total = (spec.delayMs ?? 0) + spec.durationMs;
    if (total > latest) latest = total;
  }

  if (onComplete !== undefined) {
    const timer = host.delayedCall(latest, finish);
    tracker.track({
      finalize() {
        finish();
        timer.stop();
      },
      stop: timer.stop,
    });
  }
}

/** Reduced-motion path: jump every target straight to its end state, no tweening. */
export function runChoreographyInstant(specs: readonly TweenSpec[], onComplete?: () => void): void {
  for (const spec of specs) {
    applyMotion(spec.target, spec.yoyo === true && spec.from ? spec.from : spec.to);
    // One settle-tick of the per-frame hook so visual dependants see the end state.
    spec.onUpdate?.(spec.target);
    spec.onSettle?.();
  }
  onComplete?.();
}

/**
 * Hand-authored timing per motion type (~200–350ms, ease per motion feel).
 * Durations are per phase; staggered choreographies multiply by card count.
 */
export const TIMING = {
  /** Room cards slide in from the deck side, staggered per card. */
  deal: { durationMs: 240, staggerMs: 70, ease: 'Back.easeOut' },
  /** Selected card lifts toward the viewer; ring glow pulses. */
  lift: { durationMs: 150, ease: 'Sine.easeOut' },
  /** Attacker lunges at the target. */
  lunge: { durationMs: 170, ease: 'Cubic.easeIn' },
  /** Attacker returns to its zone after impact. */
  retreat: { durationMs: 220, ease: 'Sine.easeOut' },
  /** Victim reaction pulse (yoyo). */
  impact: { durationMs: 140, ease: 'Quad.easeOut' },
  /** Defeated monster drops onto the kill stack with a small settle. */
  stackDrop: { durationMs: 260, ease: 'Back.easeOut' },
  /** Resolved card leaves the table (fade/slide out). */
  exit: { durationMs: 240, ease: 'Quad.easeIn' },
  /** Potion glow pulse over the quaffed card (yoyo). */
  glow: { durationMs: 180, ease: 'Sine.easeInOut' },
  /** Run-away / discard sweep out, staggered. */
  sweep: { durationMs: 220, staggerMs: 50, ease: 'Quad.easeIn' },
  /** Rebuild cross-fade. */
  crossFade: { durationMs: 180, ease: 'Sine.easeOut' },
  /** Win/lose flourish pulse/wash. */
  flourish: { durationMs: 340, ease: 'Sine.easeInOut' },
  /** Error nudge shake (yoyo, repeated). */
  shake: { durationMs: 55, ease: 'Sine.easeInOut' },
  /** Floating damage/heal number linger. */
  float: { durationMs: 600, ease: 'Sine.easeOut' },
  /** Room reflow when remaining cards settle into their new slots. */
  reflow: { durationMs: 180, ease: 'Sine.easeOut' },
  /** Decorative HP bar drain (canvas-only; the DOM meter stays canonical). */
  hpDrain: { durationMs: 300, ease: 'Sine.easeOut' },
  /** HP damage flash pulse (yoyo). */
  hpFlash: { durationMs: 160, ease: 'Quad.easeOut' },
  /** Weapon-strain flash when the held weapon could not cut the kill (yoyo). */
  strain: { durationMs: 130, ease: 'Quad.easeOut' },
  /** Potion heal burst motes (per mote, staggered by index). */
  burst: { durationMs: 460, ease: 'Quad.easeOut' },
} as const;
