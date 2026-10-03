import { useLayoutEffect, useRef, useState } from 'react';
import type { CardId, GameState } from '../engine';
import type { BoardBridge } from '../game/bridge';
import { buildBoardProjection, type ProjectionLayout } from '../game/board-projection';
import { attachGodotTransport, type GodotTransport } from '../game/godot-transport';
import { GODOT_BUILD_ID } from '../game/godot-build-id';
import { useGameStore } from '../store/game-store';
import { prefersReducedMotion } from './motion';
import type { BoardLayoutView } from './use-board-layout';

/**
 * React mount wrapper for the Godot web board — Phase 2 form of the host from
 * godot-plan.md "Transport contract and synchronization" and "Embed and
 * lifecycle choice".
 *
 * Owns ONE same-origin iframe confined to the room rectangle; everything
 * crosses as JSON through the session-scoped transport. Phase 2 machinery on
 * top of the Phase 1 spike:
 *
 * - Ordering fields: `revision` (transport-owned), `runGeneration` (bumped on
 *   observed fresh-run starts/replacements; a hydrate resume does NOT bump),
 *   `layoutRevision` (bumped whenever the authoritative rect set changes),
 *   `fxSeq` (store pass-through). Promotion requires the applied triple to
 *   match the LAST SENT triple — a stale acknowledgement stays in
 *   synchronizing and a later applied completes promotion (the plan's
 *   regression sequence, supersession included).
 * - `bridge-ready` handshake: the frame announces its sink; the host answers
 *   with the latest snapshot. Until then the frame's shell coalesces
 *   (latest-wins), so pre-ready sends are never replayed as history.
 * - `hover` rides the existing store⇄scene bridge (transient, no replay) and
 *   is forwarded to the frame; `policy` re-sends on OS reduced-motion flips.
 * - `diagnostics` opt-in (query flag `godot-diagnostics`): the frame reports
 *   rendered sprite bounds per applied revision; the host mirrors the latest
 *   onto `window.__godotParity` for the sprite-parity e2e (≤1px vs DOM rects).
 *
 * Guarantees carried over from Phase 1: jsdom/test guard; WebAssembly+WebGL2
 * preflight before any Godot fetch; no sync before the first valid layout
 * measurement; fresh session per mount (StrictMode-safe); boot timeout →
 * DOM fallback; no retry loop; DOM stays fully playable throughout.
 */

/** Boot deadline: generous for a slow first download; no retry loop (plan:
 * "Avoid auto-retrying a failing Godot boot in a loop"). */
const BOOT_TIMEOUT_MS = 45_000;

interface GodotBoardProps {
  /** Authoritative layout from useBoardLayout (shared with the DOM hit-layer). */
  layout: BoardLayoutView;
  /** Store⇄scene channel owned by PlayScreen; hover is forwarded from here. */
  bridge: BoardBridge | null;
  /** Live flip: true when the frame renders the current ordered triple, false on teardown/failure. */
  onLiveChange?: (live: boolean) => void;
}

function hasWebSupport(): boolean {
  try {
    if (
      typeof WebAssembly === 'undefined' ||
      !WebAssembly.validate(new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]))
    ) {
      return false;
    }
    const canvas = document.createElement('canvas');
    return canvas.getContext('webgl2') !== null;
  } catch {
    return false;
  }
}

/** Test/dev opt-in for sprite-parity diagnostics (query or hash query). */
function diagnosticsRequested(): boolean {
  const hashQuery = window.location.hash.split('?')[1] ?? '';
  return (
    new URLSearchParams(window.location.search).has('godot-diagnostics') ||
    new URLSearchParams(hashQuery).has('godot-diagnostics')
  );
}

export function GodotBoard({ layout, bridge, onLiveChange }: GodotBoardProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [live, setLive] = useState(false);
  const [failed, setFailed] = useState(false);
  const onLiveChangeRef = useRef(onLiveChange);
  onLiveChangeRef.current = onLiveChange;
  // Bridges the mount effect (transport owner) and the layout effect: the
  // transport and its send path are created once per mount; re-measurements
  // bump the layout revision and re-send through this ref instead of
  // recreating the session.
  const sendLatestRef = useRef<(() => void) | null>(null);
  // Latest authoritative layout, shared by both effects (the mount effect's
  // send path reads it at send time, so re-measurements are always fresh).
  const latestLayoutRef = useRef<ProjectionLayout>({
    rects: layout.rects,
    measured: layout.measured,
  });
  // Ordering counters, shared by both effects + the store subscription
  // (runGeneration bumps there; layoutRevision bumps in the layout effect).
  const runGenerationRef = useRef(1);
  const layoutRevisionRef = useRef(1);
  const diagnosticsRef = useRef(false);

  useLayoutEffect(() => {
    const iframe = iframeRef.current;
    if (iframe === null) return;

    // ── Environment guards — before any Godot artifact is fetched ──────────
    if (import.meta.env.MODE === 'test') return; // jsdom/RTL: never mount the frame
    if (!hasWebSupport()) return; // WASM/WebGL2 unavailable: DOM fallback
    if (!layout.measured) return; // no valid room measurement yet

    let disposed = false;
    let liveNow = false;
    let failedNow = false;
    diagnosticsRef.current = diagnosticsRequested();
    // Latest inputs for the next sync; refreshed by the store subscription.
    let latestState: GameState | null = useGameStore.getState().game;
    let latestSelected: CardId | null = useGameStore.getState().selectedCardId;
    let latestFxSeq = useGameStore.getState().fxSeq;

    const notifyLive = (value: boolean): void => {
      if (liveNow === value) return;
      liveNow = value;
      setLive(value);
      onLiveChangeRef.current?.(value);
    };

    const fail = (code: string, message: string): void => {
      if (failedNow || disposed) return;
      failedNow = true;
      // eslint-disable-next-line no-console -- developer-facing diagnostics (plan: expose diagnostics to developers)
      console.warn(`[godot-board] falling back to DOM (${code}): ${message}`);
      notifyLive(false);
      setFailed(true); // unmounts the iframe; this effect's cleanup finishes teardown
    };

    const transport: GodotTransport = attachGodotTransport(
      GODOT_BUILD_ID,
      () => (disposed ? null : (iframeRef.current?.contentWindow ?? null)),
      {
        onBridgeReady() {
          if (disposed || failedNow) return;
          // The plan: on bridge-ready the parent sends its latest complete
          // snapshot immediately and never gates delivery on readiness.
          sendLatestRef.current?.();
          // Initial policy — the frame needs the motion policy even if no
          // store change follows.
          transport.sendPolicy(prefersReducedMotion());
        },
        onApplied(revision, appliedGeneration, appliedLayout) {
          if (disposed || failedNow) return;
          const sent = transport.lastSent;
          // Promote only when the applied triple matches the LAST SENT
          // snapshot (plan: session + run generation + revision + layout
          // revision). A stale acknowledgement is not a failure — stay in
          // synchronizing; a later applied completes promotion.
          if (
            revision !== sent.revision ||
            appliedGeneration !== sent.runGeneration ||
            appliedLayout !== sent.layoutRevision
          ) {
            return;
          }
          // Cancel DOM room ghosts in the same commit: two renderers must not
          // animate the same pixels (PlayScreen's director drops room beats
          // once the canvas-live marker appears — see motion.ts).
          notifyLive(true);
        },
        onSettled() {
          /* Phase 3 consumes settled for choreography quiescence; static
             Phase 2 boards settle with every applied. */
        },
        onDiagnostics(revision, appliedGeneration, appliedLayout, rects) {
          if (disposed || !diagnosticsRef.current) return;
          const sent = transport.lastSent;
          if (
            revision !== sent.revision ||
            appliedGeneration !== sent.runGeneration ||
            appliedLayout !== sent.layoutRevision
          ) {
            return; // only mirror the current triple
          }
          (window as unknown as { __godotParity?: unknown }).__godotParity = {
            revision,
            runGeneration: appliedGeneration,
            layoutRevision: appliedLayout,
            rects,
          };
        },
        onError(code, message) {
          fail(code, message);
        },
      },
    );

    const sendLatest = (): void => {
      if (disposed || failedNow || !latestLayoutRef.current.measured) return;
      const projection = buildBoardProjection({
        state: latestState,
        selectedCardId: latestSelected,
        reducedMotion: prefersReducedMotion(),
        layout: latestLayoutRef.current,
      });
      transport.sendSync({
        projection,
        runGeneration: runGenerationRef.current,
        layoutRevision: layoutRevisionRef.current,
        fxSeq: latestFxSeq,
        diagnostics: diagnosticsRef.current,
      });
    };
    sendLatestRef.current = sendLatest;

    const unsubscribeStore = useGameStore.subscribe((state, prevState) => {
      latestState = state.game;
      latestSelected = state.selectedCardId;
      latestFxSeq = state.fxSeq;
      // runGeneration derivation (plan §Transport: transient, not a save
      // schema change; discriminator = runResumed):
      //   null → game : fresh start bumps; hydrate resume does NOT.
      //   game → game swap with a null result: seeded-URL replacement bumps.
      const prevGame = prevState.game;
      if (prevGame === null && state.game !== null) {
        if (!state.runResumed) runGenerationRef.current += 1;
      } else if (
        prevGame !== null &&
        state.game !== null &&
        state.game !== prevGame &&
        state.lastResult === null &&
        !state.runResumed
      ) {
        runGenerationRef.current += 1;
      }
      queueMicrotask(sendLatest);
    });

    // Hover: forwarded from the store⇄scene bridge — transient, never replayed.
    const unsubscribeHover = bridge?.onCardHover((payload) => {
      if (disposed || failedNow) return;
      transport.sendHover(payload.cardId, payload.over);
    });

    // Policy: OS reduced-motion flips are pushed immediately (the persisted
    // setting is read fresh at every sync; it has no change event).
    let mediaQuery: MediaQueryList | null = null;
    const onPolicyChange = (): void => {
      if (disposed || failedNow) return;
      transport.sendPolicy(prefersReducedMotion());
    };
    if (typeof window.matchMedia === 'function') {
      mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      mediaQuery.addEventListener('change', onPolicyChange);
    }

    // The frame's shell registers its message listener during parse; messages
    // posted before that are queued by the browser — the load resend is the
    // belt-and-braces for any gap (fresh session truth right after boot).
    const handleLoad = (): void => sendLatest();
    iframe.addEventListener('load', handleLoad);

    const bootTimer = window.setTimeout(() => {
      if (!liveNow) fail('timeout', `no applied revision within ${BOOT_TIMEOUT_MS}ms`);
    }, BOOT_TIMEOUT_MS);

    sendLatest(); // mount/hydrate/resume path: the initial snapshot

    return () => {
      disposed = true;
      sendLatestRef.current = null;
      window.clearTimeout(bootTimer);
      iframe.removeEventListener('load', handleLoad);
      mediaQuery?.removeEventListener('change', onPolicyChange);
      unsubscribeStore();
      unsubscribeHover?.();
      transport.dispose();
      notifyLive(false);
    };
    // Mount contract mirrors PhaserBoard: one session per mount, created when
    // the first valid measurement arrives (deps below). The initial layout
    // snapshot is captured above; later rect changes flow through
    // sendLatestRef (the effect below). bridge is stable per PlayScreen mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout.measured, bridge]);

  // Layout re-measurement (resize/zoom/orientation): bump the layout revision
  // and refresh the frame with the authoritative rects — same session. Skipped
  // when the identity is unchanged (first commit replays the mount snapshot).
  useLayoutEffect(() => {
    if (import.meta.env.MODE === 'test') return;
    if (iframeRef.current === null || !layout.measured) return;
    const current = latestLayoutRef.current;
    if (current.rects === layout.rects && current.measured === layout.measured) return;
    latestLayoutRef.current = { rects: layout.rects, measured: layout.measured };
    layoutRevisionRef.current += 1;
    sendLatestRef.current?.();
  }, [layout.rects, layout.measured]);

  if (import.meta.env.MODE === 'test') return null; // jsdom: render nothing
  if (failed) return null; // DOM fallback took ownership

  return (
    <iframe
      ref={iframeRef}
      className={live ? 'godot-board canvas-live' : 'godot-board'}
      title="Card table renderer"
      src={`${import.meta.env.BASE_URL}godot/${GODOT_BUILD_ID}/board.html`}
      aria-hidden="true" // decorative pixels; the DOM hit-layer owns semantics
      tabIndex={-1} // no tab stop: keyboard focus stays with the parent DOM
      /* Same commit as `canvas-live` — e2e waits on this attribute instead of
         racing the class flip (mirrors PhaserBoard's probe). */
      data-canvas-ready={live ? 'true' : 'false'}
    />
  );
}
