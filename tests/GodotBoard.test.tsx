import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBoardBridge } from '../src/game/bridge';
import { DEFAULT_CONFIG } from '../src/engine';
import { useGameStore } from '../src/store/game-store';
import { GodotBoard } from '../src/ui/GodotBoard';
import type { BoardLayoutView } from '../src/ui/use-board-layout';

/**
 * Wrapper tests for the Godot board frame (godot-plan.md §Test plan 1 — the
 * Phase 2 host machinery) — mocked at the transport boundary, no Godot
 * runtime in jsdom: ordered-triple promotion gating, stale-acknowledgement
 * rejection, runGeneration derivation (fresh start bumps, hydrate resume does
 * NOT), layoutRevision bumps, bridge-ready handshake, hover forwarding,
 * diagnostics mirroring, error fallback, and unmount disposal.
 */

const h = vi.hoisted(() => {
  const state = { revision: 0, runGeneration: 1, layoutRevision: 1 };
  const sends: Array<Record<string, unknown>> = [];
  const callbacks: {
    current: {
      onBridgeReady: () => void;
      onApplied: (r: number, g: number, l: number) => void;
      onSettled: (r: number, g: number, l: number) => void;
      onDiagnostics: (r: number, g: number, l: number, rects: unknown) => void;
      onError: (code: string, message: string) => void;
    } | null;
  } = {
    current: null,
  };
  const transport = {
    sessionId: 'sess-test',
    get lastSent() {
      return {
        revision: state.revision,
        runGeneration: state.runGeneration,
        layoutRevision: state.layoutRevision,
      };
    },
    sendSync: vi.fn(
      (input: {
        projection: unknown;
        runGeneration: number;
        layoutRevision: number;
        fxSeq: number;
        diagnostics: boolean;
      }) => {
        state.revision += 1;
        state.runGeneration = input.runGeneration;
        state.layoutRevision = input.layoutRevision;
        sends.push({ kind: 'sync', revision: state.revision, ...input });
      },
    ),
    sendHover: vi.fn((cardId: string, over: boolean) => {
      sends.push({ kind: 'hover', cardId, over });
    }),
    sendPolicy: vi.fn((reducedMotion: boolean) => {
      sends.push({ kind: 'policy', reducedMotion });
    }),
    sendDispose: vi.fn(),
    dispose: vi.fn(),
  };
  return { state, sends, callbacks, transport };
});

vi.mock('../src/game/godot-transport', () => ({
  attachGodotTransport: vi.fn((_buildId: unknown, _getWindow: unknown, attached: unknown) => {
    h.callbacks.current = attached as typeof h.callbacks.current;
    return h.transport;
  }),
}));

const LAYOUT: BoardLayoutView = {
  rects: [0, 1, 2, 3].map((i) => ({ x: i * 214, y: 0, width: 192, height: 268.8 })),
  roomHeight: 304.8,
  cardWidth: 192,
  cardHeight: 268.8,
  columns: 4,
  rows: 1,
  gap: 22,
  measured: true,
};

function startSeededRun(): void {
  useGameStore.getState().startRun('s20', DEFAULT_CONFIG);
}

function renderBoard(
  layout: BoardLayoutView = LAYOUT,
  bridge: ReturnType<typeof createBoardBridge> | null = null,
) {
  const onLiveChange = vi.fn();
  const view = render(<GodotBoard layout={layout} bridge={bridge} onLiveChange={onLiveChange} />);
  return { ...view, onLiveChange };
}

function flushSyncs(): Promise<void> {
  // Sends are microtask-deferred; async act flushes them.
  return act(async () => {});
}

describe('GodotBoard (transport mocked)', () => {
  beforeEach(() => {
    vi.stubEnv('MODE', 'development');
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      {} as CanvasRenderingContext2D,
    );
    h.state.revision = 0;
    h.state.runGeneration = 1;
    h.state.layoutRevision = 1;
    h.sends.length = 0;
    h.callbacks.current = null;
    h.transport.sendSync.mockClear();
    h.transport.sendHover.mockClear();
    h.transport.sendPolicy.mockClear();
    h.transport.sendDispose.mockClear();
    h.transport.dispose.mockClear();
    useGameStore.getState().reset();
    startSeededRun();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('renders the frame and sends the initial sync with the ordered triple', async () => {
    const { container } = renderBoard();
    await flushSyncs();
    const iframe = container.querySelector('iframe.godot-board');
    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute('src')).toMatch(/\/godot\/[a-z0-9-]+\/board\.html/);
    expect(h.sends).toHaveLength(1);
    const first = h.sends[0] as {
      kind: string;
      revision: number;
      runGeneration: number;
      layoutRevision: number;
      fxSeq: number;
      diagnostics: boolean;
      projection: { room: Array<{ cardId: string }> };
    };
    expect(first).toMatchObject({
      kind: 'sync',
      revision: 1,
      runGeneration: 1,
      layoutRevision: 1,
      fxSeq: 0,
      diagnostics: false,
    });
    const game = useGameStore.getState().game;
    expect(first.projection.room.map((c) => c.cardId)).toEqual(game?.room);
  });

  it('promotes live only on the applied triple matching the last sent snapshot', async () => {
    const { container, onLiveChange } = renderBoard();
    await flushSyncs();
    // Wrong generation/layout first — stale acknowledgements are not failures.
    act(() => h.callbacks.current?.onApplied(1, 9, 1));
    act(() => h.callbacks.current?.onApplied(1, 1, 9));
    expect(container.querySelector('[data-canvas-ready="true"]')).toBeNull();
    expect(onLiveChange).not.toHaveBeenCalledWith(true);

    act(() => h.callbacks.current?.onApplied(1, 1, 1)); // exact triple
    expect(container.querySelector('[data-canvas-ready="true"]')).not.toBeNull();
    expect(onLiveChange).toHaveBeenCalledWith(true);
  });

  it('rejects a stale revision after a selection change and promotes on the current one', async () => {
    const { container } = renderBoard();
    await flushSyncs();
    await act(async () => {
      useGameStore.getState().selectCard(useGameStore.getState().game?.room[0] ?? null);
    });
    expect(h.state.revision).toBe(2);

    act(() => h.callbacks.current?.onApplied(1, 1, 1)); // stale — not the latest sync
    expect(container.querySelector('[data-canvas-ready="true"]')).toBeNull();

    act(() => h.callbacks.current?.onApplied(2, 1, 1)); // the current triple lands
    expect(container.querySelector('[data-canvas-ready="true"]')).not.toBeNull();
    const last = h.sends[h.sends.length - 1] as { projection: { selectedCardId: string | null } };
    expect(last.projection.selectedCardId).toBe(useGameStore.getState().game?.room[0]);
  });

  it('bumps runGeneration on a fresh run start after mount', async () => {
    useGameStore.getState().reset(); // game null — no run yet
    renderBoard();
    await flushSyncs();
    expect((h.sends[0] as { runGeneration: number }).runGeneration).toBe(1);

    await act(async () => {
      startSeededRun(); // fresh start (runResumed=false) → bump
    });
    const last = h.sends[h.sends.length - 1] as { runGeneration: number };
    expect(last.runGeneration).toBe(2);
  });

  it('does NOT bump runGeneration on a hydrate resume', async () => {
    useGameStore.getState().reset();
    renderBoard();
    await flushSyncs();

    await act(async () => {
      startSeededRun(); // bump to 2
    });
    await act(async () => {
      useGameStore.getState().reset(); // game null again (no bump on null-out)
      useGameStore.getState().hydrate(); // resume — runResumed=true → no bump
    });
    const last = h.sends[h.sends.length - 1] as { runGeneration: number };
    expect(last.runGeneration).toBe(2);
  });

  it('answers bridge-ready with the latest sync and a policy push', async () => {
    renderBoard();
    await flushSyncs();
    const syncsBefore = h.sends.filter((s) => s.kind === 'sync').length;
    act(() => h.callbacks.current?.onBridgeReady());
    expect(h.transport.sendPolicy).toHaveBeenCalledWith(false);
    expect(h.sends.filter((s) => s.kind === 'sync')).toHaveLength(syncsBefore + 1); // latest snapshot re-sent
  });

  it('forwards hover from the store⇄scene bridge without replaying it', async () => {
    const bridge = createBoardBridge();
    renderBoard(LAYOUT, bridge);
    await flushSyncs();
    const hoverCount = h.sends.filter((s) => s.kind === 'hover').length;
    await act(async () => {
      bridge.emitCardHover({ cardId: 'spade-8', over: true });
    });
    expect(h.sends.filter((s) => s.kind === 'hover')).toHaveLength(hoverCount + 1);
    const last = h.sends[h.sends.length - 1] as { kind: string; cardId: string; over: boolean };
    expect(last).toMatchObject({ kind: 'hover', cardId: 'spade-8', over: true });
  });

  it('mirrors rendered sprite bounds when diagnostics are requested', async () => {
    window.location.hash = '#/play?seed=s20&godot-diagnostics=1';
    renderBoard();
    await flushSyncs();
    expect((h.sends[0] as { diagnostics: boolean }).diagnostics).toBe(true);
    const rects = [{ cardId: 'diamond-5', x: 0, y: 0, width: 192, height: 268.8 }];
    act(() =>
      h.callbacks.current?.onDiagnostics(
        h.state.revision,
        h.state.runGeneration,
        h.state.layoutRevision,
        rects,
      ),
    );
    expect((window as unknown as { __godotParity?: unknown }).__godotParity).toMatchObject({
      revision: h.state.revision,
      rects,
    });
    window.location.hash = '';
  });

  it('falls back to DOM on a structured error (iframe removed, live never flips)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container, onLiveChange } = renderBoard();
    act(() => h.callbacks.current?.onError('boot', 'wasm fetch failed'));
    expect(container.querySelector('iframe.godot-board')).toBeNull();
    expect(onLiveChange).not.toHaveBeenCalledWith(true);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('falling back to DOM'));
    // A late applied after the failure must not revive the dead frame.
    expect(() => h.callbacks.current?.onApplied(1, 1, 1)).not.toThrow();
    expect(container.querySelector('iframe.godot-board')).toBeNull();
  });

  it('disposes the session on unmount', () => {
    const { unmount } = renderBoard();
    unmount();
    expect(h.transport.dispose).toHaveBeenCalledTimes(1);
  });

  it('sends nothing before a valid measurement', () => {
    renderBoard({ ...LAYOUT, measured: false, rects: [] });
    expect(h.sends).toHaveLength(0);
  });

  it('bumps layoutRevision on re-measurement without recreating the session', async () => {
    const { rerender } = renderBoard();
    await flushSyncs();
    const nextRects = [{ x: 8, y: 18, width: 96, height: 134.4 }];
    rerender(<GodotBoard layout={{ ...LAYOUT, rects: nextRects }} bridge={null} />);
    await flushSyncs();
    const last = h.sends[h.sends.length - 1] as {
      layoutRevision: number;
      projection: { room: Array<{ x: number }> };
    };
    expect(last.layoutRevision).toBe(2);
    expect(last.projection.room[0]?.x).toBe(8);
  });
});
