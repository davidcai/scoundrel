import { useLayoutEffect, useRef, useState } from 'react';
import type { CardId, GameState } from '../engine';
import { buildBoardProjection, type ProjectionLayout } from '../game/board-projection';
import { attachGodotTransport, type GodotTransport } from '../game/godot-transport';
import { GODOT_BUILD_ID } from '../game/godot-build-id';
import { useGameStore } from '../store/game-store';
import { prefersReducedMotion } from './motion';
import type { BoardLayoutView } from './use-board-layout';

/**
 * React mount wrapper for the Godot web board — the Phase 1 spike counterpart
 * of PhaserBoard (godot-plan.md, "Embed and lifecycle choice").
 *
 * Owns ONE same-origin iframe confined to the room rectangle. The iframe
 * loads the exported Godot app (`public/godot/<GODOT_BUILD_ID>/board.html`,
 * produced by `scripts/export-godot.mjs`); everything crosses the boundary as
 * JSON through the session-scoped transport:
 *
 *   store/measure change → buildBoardProjection → transport.sendSync
 *   frame renders a sync → `applied(revision)` → first one flips live
 *   frame boot/protocol failure or boot timeout → DOM fallback (this
 *     component renders nothing, exactly like the no-WebGL Phaser path)
 *
 * Guarantees (mirroring PhaserBoard's contract):
 * - jsdom/test guard FIRST: under vitest nothing is rendered and no iframe is
 *   mounted (the transport is mocked in wrapper tests).
 * - Web support preflight (WebAssembly + WebGL 2) before any Godot fetch;
 *   unsupported browsers render nothing — DOM stays the renderer (the canvas
 *   can never be a prerequisite for playing).
 * - The frame canvas is decorative: no tab stop, aria-hidden, and the iframe
 *   box equals the `.room` border box (`position: absolute; inset: 0`), the
 *   same coordinate space the projection rects use.
 * - StrictMode / rapid routes: each mount gets a fresh session (transport),
 *   so late messages from an old frame are rejected; cleanup disposes
 *   synchronously (unsubscribe → remove listeners → notifyLive(false) →
 *   request quit) and React removes the iframe.
 * - No sync leaves the host before the first valid layout measurement, so the
 *   frame can never be promoted live with geometry the host doesn't know
 *   ("ignore zero-size hidden layouts until a valid measurement arrives").
 *
 * Phase 1 minimal lifecycle: idle → (iframe mounted) → live on the first
 * `applied` whose revision matches the latest sent sync, or `failed` on a
 * structured `error`, on boot timeout, or when the frame dies. The plan's
 * full synchronizing/supersession machinery (runGeneration/layoutRevision)
 * is Phase 2; the latest-wins shell makes revision churn harmless meanwhile.
 */

/** Boot deadline: generous for a slow first download; no retry loop (plan:
 * "Avoid auto-retrying a failing Godot boot in a loop"). */
const BOOT_TIMEOUT_MS = 45_000;

interface GodotBoardProps {
  /** Authoritative layout from useBoardLayout (shared with the DOM hit-layer). */
  layout: BoardLayoutView;
  /** Live flip: true when the frame first renders the current session, false on teardown/failure. */
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

export function GodotBoard({ layout, onLiveChange }: GodotBoardProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [live, setLive] = useState(false);
  const [failed, setFailed] = useState(false);
  const onLiveChangeRef = useRef(onLiveChange);
  onLiveChangeRef.current = onLiveChange;
  // Bridges the mount effect (transport owner) and the layout effect: the
  // transport and its send path are created once per mount; re-measurements
  // re-send through this ref instead of recreating the session.
  const sendLatestRef = useRef<(() => void) | null>(null);
  // Latest authoritative layout, shared by both effects (the mount effect's
  // send path reads it at send time, so re-measurements are always fresh).
  const latestLayoutRef = useRef<ProjectionLayout>({
    rects: layout.rects,
    measured: layout.measured,
  });

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
    // Latest inputs for the next sync; state/selection are refreshed by the
    // store subscription, the layout by latestLayoutRef (layout effect below).
    let latestState: GameState | null = useGameStore.getState().game;
    let latestSelected: CardId | null = useGameStore.getState().selectedCardId;

    const notifyLive = (value: boolean): void => {
      if (liveNow === value) return;
      liveNow = value;
      setLive(value);
      onLiveChangeRef.current?.(value);
    };

    const fail = (code: string, message: string): void => {
      if (failedNow || disposed) return;
      failedNow = true;

      console.warn(`[godot-board] falling back to DOM (${code}): ${message}`);
      notifyLive(false);
      setFailed(true); // unmounts the iframe; this effect's cleanup finishes teardown
    };

    const transport: GodotTransport = attachGodotTransport(
      () => (disposed ? null : (iframeRef.current?.contentWindow ?? null)),
      {
        onApplied(revision) {
          if (disposed || failedNow) return;
          // Promote only on the CURRENT revision — a stale acknowledgement
          // stays in synchronizing and a later applied completes promotion
          // (plan regression sequence, Phase 1 minimal form).
          if (revision !== transport.lastRevision) return;
          // Cancel DOM room ghosts in the same commit: two renderers must not
          // animate the same pixels (PlayScreen's director drops room beats
          // once the canvas-live marker appears — see motion.ts).
          notifyLive(true);
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
      transport.sendSync(projection);
    };
    sendLatestRef.current = sendLatest;

    const unsubscribeStore = useGameStore.subscribe((state) => {
      latestState = state.game;
      latestSelected = state.selectedCardId;
      sendLatest();
    });

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
      unsubscribeStore();
      transport.dispose();
      notifyLive(false);
    };
    // Mount contract mirrors PhaserBoard: one session per mount, created when
    // the first valid measurement arrives (deps below). Later rect changes
    // flow through sendLatestRef (the effect below).
  }, [layout.measured]);

  // Layout re-measurement (resize/zoom/orientation): refresh the frame with
  // the authoritative rects — same session, revision-bumped sync. Skipped when
  // the identity is unchanged (first commit replays the mount snapshot).
  useLayoutEffect(() => {
    if (import.meta.env.MODE === 'test') return;
    if (iframeRef.current === null || !layout.measured) return;
    const current = latestLayoutRef.current;
    if (current.rects === layout.rects && current.measured === layout.measured) return;
    latestLayoutRef.current = { rects: layout.rects, measured: layout.measured };
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
