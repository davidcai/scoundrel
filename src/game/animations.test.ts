import { describe, expect, it } from 'vitest';
import {
  applyMotion,
  runChoreography,
  runChoreographyInstant,
  TIMING,
  TweenTracker,
  type MotionProps,
  type MotionTarget,
  type TweenHost,
  type TweenSpec,
} from './animations';

/**
 * Fake tween clock for the interruption policy: the host records every spec;
 * `advance(ms)` simulates the Phaser clock — tweens whose delay+duration have
 * elapsed settle (Phaser applies the end values itself; the fake mirrors that
 * by writing `to`), and their onSettle side effects run exactly once.
 */
class FakeTweenHost implements TweenHost {
  readonly tweens: { spec: TweenSpec; stopped: boolean }[] = [];
  readonly timers: { ms: number; cb: () => void; stopped: boolean }[] = [];
  private elapsed = 0;

  add(spec: TweenSpec): { stop(): void } {
    const entry = { spec, stopped: false };
    this.tweens.push(entry);
    return {
      stop: () => {
        entry.stopped = true;
      },
    };
  }

  delayedCall(ms: number, cb: () => void): { stop(): void } {
    const entry = { ms, cb, stopped: false };
    this.timers.push(entry);
    return {
      stop: () => {
        entry.stopped = true;
      },
    };
  }

  advance(ms: number): void {
    this.elapsed += ms;
    for (const timer of this.timers) {
      if (!timer.stopped && timer.ms <= this.elapsed) {
        timer.stopped = true;
        timer.cb();
      }
    }
    for (const entry of this.tweens) {
      if (entry.stopped) continue;
      const total = (entry.spec.delayMs ?? 0) + entry.spec.durationMs;
      if (total <= this.elapsed) {
        entry.stopped = true;
        applyMotion(entry.spec.target, entry.spec.to);
        // The Phaser host fires onUpdate each frame; the fake ticks once at settle.
        entry.spec.onUpdate?.(entry.spec.target);
        entry.spec.onSettle?.();
      }
    }
  }

  get isIdle(): boolean {
    return this.tweens.every((t) => t.stopped) && this.timers.every((t) => t.stopped);
  }
}

function makeTarget(x = 0, y = 0): MotionTarget {
  return { x, y, alpha: 1, scaleX: 1, scaleY: 1, angle: 0 };
}

const moveSpec = (
  target: MotionTarget,
  toX: number,
  overrides?: Partial<TweenSpec>,
): TweenSpec => ({
  target,
  from: { x: 0 },
  to: { x: toX },
  durationMs: TIMING.deal.durationMs,
  ease: TIMING.deal.ease,
  ...overrides,
});

describe('runChoreography (fake tween clock)', () => {
  it('drives targets to their end values and fires onComplete exactly once', () => {
    const host = new FakeTweenHost();
    const tracker = new TweenTracker();
    const target = makeTarget();
    const completed: number[] = [];

    runChoreography(host, tracker, [moveSpec(target, 100)], () => completed.push(1));
    host.advance(TIMING.deal.durationMs + 1);

    expect(target.x).toBe(100);
    expect(completed).toEqual([1]);
    expect(host.isIdle).toBe(true);
  });

  it('applies explicit from values before the tween starts', () => {
    const host = new FakeTweenHost();
    const tracker = new TweenTracker();
    const target = makeTarget(50);

    runChoreography(host, tracker, [
      { target, from: { x: -120, alpha: 0 }, to: { x: 100, alpha: 1 }, durationMs: 100 },
    ]);

    expect(target.x).toBe(-120); // from applied synchronously at start
    expect(target.alpha).toBe(0);

    host.advance(150);
    expect(target.x).toBe(100);
    expect(target.alpha).toBe(1);
  });

  it('SNAP: in-flight tweens are finalized with manual end-value writes before stopping', () => {
    const host = new FakeTweenHost();
    const tracker = new TweenTracker();
    const target = makeTarget();
    const settled: string[] = [];
    const completed: number[] = [];

    runChoreography(
      host,
      tracker,
      [{ ...moveSpec(target, 100), onSettle: () => settled.push('settle') }],
      () => completed.push(1),
    );
    expect(tracker.size).toBeGreaterThan(0);

    // New command arrives mid-flight → the scene snaps ALL in-flight tweens.
    tracker.snapAll();

    // tween.stop() does NOT write end values — finalize() did, manually.
    expect(target.x).toBe(100);
    expect(settled).toEqual(['settle']); // inventory side effects ran
    expect(completed).toEqual([1]); // the choreography's completion fired
    expect(host.tweens.every((t) => t.stopped)).toBe(true);
    expect(host.isIdle).toBe(true);

    // Snapping is terminal: a later clock advance cannot double-fire.
    host.advance(5000);
    expect(completed).toEqual([1]);
  });

  it('snapping a yoyo tween writes the rest state (from), not the excursion', () => {
    const host = new FakeTweenHost();
    const tracker = new TweenTracker();
    const target = makeTarget(10);

    runChoreography(host, tracker, [
      {
        target,
        from: { x: 10 },
        to: { x: 16 },
        durationMs: TIMING.shake.durationMs,
        yoyo: true,
        repeat: 2,
      },
    ]);

    tracker.snapAll(); // snapped mid-shake
    expect(target.x).toBe(10); // back at the canonical slot, not displaced
  });

  it('staggered choreographies fire onComplete after the LONGEST tween, not the first', () => {
    const host = new FakeTweenHost();
    const tracker = new TweenTracker();
    const a = makeTarget();
    const b = makeTarget();
    const completed: number[] = [];

    runChoreography(
      host,
      tracker,
      [
        moveSpec(a, 10),
        { ...moveSpec(b, 20), delayMs: 200 }, // ends later than a
      ],
      () => completed.push(1),
    );

    host.advance(TIMING.deal.durationMs + 1); // a settled, b still pending
    expect(completed).toEqual([]); // gate waits for the full choreography
    expect(a.x).toBe(10);
    expect(b.x).toBe(0);

    host.advance(200 + 1);
    expect(completed).toEqual([1]);
    expect(b.x).toBe(20);
  });

  it('a snapped choreography cannot be re-fired by its timer', () => {
    const host = new FakeTweenHost();
    const tracker = new TweenTracker();
    const target = makeTarget();
    const completed: number[] = [];

    runChoreography(host, tracker, [moveSpec(target, 100)], () => completed.push(1));
    tracker.snapAll();
    host.advance(10000);
    expect(completed).toEqual([1]);
  });

  it('empty choreographies complete synchronously', () => {
    const completed: number[] = [];
    runChoreography(new FakeTweenHost(), new TweenTracker(), [], () => completed.push(1));
    expect(completed).toEqual([1]);
  });
});

describe('runChoreographyInstant (reduced motion)', () => {
  it('jumps every target straight to its end state with no tweening', () => {
    const target = makeTarget(50);
    const settled: string[] = [];
    const completed: number[] = [];

    runChoreographyInstant(
      [{ ...moveSpec(target, 100), onSettle: () => settled.push('settle') }],
      () => completed.push(1),
    );

    expect(target.x).toBe(100); // end state, synchronously
    expect(settled).toEqual(['settle']); // inventory side effects ran (exits destroy)
    expect(completed).toEqual([1]);
  });

  it('reduced-motion yoyo specs (error shake) land on the rest state or skip entirely', () => {
    const target = makeTarget(30);
    runChoreographyInstant([
      { target, from: { x: 30 }, to: { x: 36 }, durationMs: 50, yoyo: true },
    ]);
    expect(target.x).toBe(30); // yoyo end state === from
  });

  it('fires the onUpdate hook once so visual dependants see the end state', () => {
    const target = makeTarget(50);
    const seen: number[] = [];
    runChoreographyInstant([{ ...moveSpec(target, 100), onUpdate: (t) => seen.push(t.x) }]);
    expect(seen).toEqual([100]);
    expect(target.x).toBe(100);
  });
});

describe('onUpdate pass-through (animated HP drain seam)', () => {
  it('snap mid-drain writes end values and the exact value lands via onSettle', () => {
    const host = new FakeTweenHost();
    const tracker = new TweenTracker();
    const target = makeTarget();
    const ticks: number[] = [];
    const settledValues: number[] = [];

    runChoreography(host, tracker, [
      {
        target,
        from: { x: 0 },
        to: { x: 70 },
        durationMs: TIMING.hpDrain.durationMs,
        ease: TIMING.hpDrain.ease,
        onUpdate: (t) => ticks.push(t.x),
        onSettle: () => settledValues.push(target.x),
      },
    ]);

    // Snap mid-drain: finalize writes end values; onSettle reads the final value.
    tracker.snapAll();
    expect(target.x).toBe(70);
    expect(settledValues).toEqual([70]);
    // Snap skips intermediate ticks (no frames driven) — the final write is exact.
    expect(ticks).toEqual([]);
  });

  it('a natural completion drives the hook then lands the exact end value', () => {
    const host = new FakeTweenHost();
    const tracker = new TweenTracker();
    const target = makeTarget();
    const ticks: number[] = [];

    runChoreography(host, tracker, [
      {
        target,
        from: { x: 0 },
        to: { x: 70 },
        durationMs: TIMING.hpDrain.durationMs,
        onUpdate: (t) => ticks.push(t.x),
      },
    ]);
    host.advance(TIMING.hpDrain.durationMs + 1);

    expect(ticks).toEqual([70]); // the fake clock's settle tick
    expect(target.x).toBe(70);
  });
});

describe('TweenTracker', () => {
  it('snapAll finalizes every tracked tween once and clears the registry', () => {
    const tracker = new TweenTracker();
    const finalized: number[] = [];
    tracker.track({ finalize: () => finalized.push(1), stop: () => undefined });
    tracker.track({ finalize: () => finalized.push(2), stop: () => undefined });
    expect(tracker.size).toBe(2);

    tracker.snapAll();
    expect(finalized).toEqual([1, 2]);
    expect(tracker.size).toBe(0);
    expect(() => tracker.snapAll()).not.toThrow(); // idempotent
  });
});

describe('applyMotion', () => {
  it('writes only the provided props', () => {
    const target = makeTarget(1, 2);
    const patch: Partial<MotionProps> = { x: 5, alpha: 0.5 };
    applyMotion(target, patch);
    expect(target.x).toBe(5);
    expect(target.alpha).toBe(0.5);
    expect(target.y).toBe(2); // untouched
    expect(target.scaleX).toBe(1); // untouched
  });
});
