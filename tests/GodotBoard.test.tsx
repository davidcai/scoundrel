import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '../src/engine';
import { useGameStore } from '../src/store/game-store';
import { GodotBoard } from '../src/ui/GodotBoard';
import type { BoardLayoutView } from '../src/ui/use-board-layout';

/**
 * Wrapper tests for the Godot board frame (godot-plan.md §Test plan 1, Phase 1
 * subset) — mocked at the transport boundary, no Godot runtime in jsdom:
 * initial projection send, live promotion on the CURRENT revision only,
 * stale-acknowledgement rejection, structured-error fallback, unmount
 * disposal, pre-measurement silence, and re-measurement re-sends on the same
 * session.
 */

const h = vi.hoisted(() => {
  const state = { revision: 0 };
  const sends: Array<{ revision: number; projection: unknown }> = [];
  const callbacks: {
    current: {
      onApplied: (r: number) => void;
      onError: (code: string, message: string) => void;
    } | null;
  } = {
    current: null,
  };
  const transport = {
    sessionId: 'sess-test',
    get lastRevision() {
      return state.revision;
    },
    sendSync: vi.fn((projection: unknown) => {
      state.revision += 1;
      sends.push({ revision: state.revision, projection });
    }),
    sendDispose: vi.fn(),
    dispose: vi.fn(),
  };
  return { state, sends, callbacks, transport };
});

vi.mock('../src/game/godot-transport', () => ({
  attachGodotTransport: vi.fn((_getWindow: unknown, attached: unknown) => {
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

function renderBoard(layout: BoardLayoutView = LAYOUT) {
  const onLiveChange = vi.fn();
  const view = render(<GodotBoard layout={layout} onLiveChange={onLiveChange} />);
  return { ...view, onLiveChange };
}

describe('GodotBoard (transport mocked)', () => {
  beforeEach(() => {
    vi.stubEnv('MODE', 'development');
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      {} as CanvasRenderingContext2D,
    );
    h.state.revision = 0;
    h.sends.length = 0;
    h.callbacks.current = null;
    h.transport.sendSync.mockClear();
    h.transport.sendDispose.mockClear();
    h.transport.dispose.mockClear();
    useGameStore.getState().reset();
    startSeededRun();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('renders the frame and sends the initial projection with the authoritative rects', () => {
    const { container } = renderBoard();
    const iframe = container.querySelector('iframe.godot-board');
    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute('src')).toContain('/godot/spike/board.html');
    expect(iframe?.getAttribute('aria-hidden')).toBe('true');
    expect(h.sends).toHaveLength(1);
    const { revision, projection } = h.sends[0] as {
      revision: number;
      projection: { room: Array<{ cardId: string; x: number }> };
    };
    expect(revision).toBe(1);
    const game = useGameStore.getState().game;
    expect(game).not.toBeNull();
    expect(projection.room.map((c) => c.cardId)).toEqual(game?.room);
    expect(projection.room[0]).toMatchObject({ x: 0, y: 0, width: 192, height: 268.8 });
  });

  it('promotes live on the applied acknowledgement for the latest revision', () => {
    const { container, onLiveChange } = renderBoard();
    expect(container.querySelector('[data-canvas-ready="true"]')).toBeNull();
    const revision = h.state.revision;
    act(() => h.callbacks.current?.onApplied(revision));
    expect(container.querySelector('[data-canvas-ready="true"]')).not.toBeNull();
    expect(onLiveChange).toHaveBeenCalledWith(true);
  });

  it('rejects a stale acknowledgement and promotes on the current one', async () => {
    const { container, onLiveChange } = renderBoard();
    // A selection change bumps the revision (latest-wins syncs); the send is
    // microtask-deferred so React's layout commit lands first.
    await act(async () => {
      useGameStore.getState().selectCard(useGameStore.getState().game?.room[0] ?? null);
    });
    expect(h.state.revision).toBe(2);

    act(() => h.callbacks.current?.onApplied(1)); // stale — not the latest sync
    expect(container.querySelector('[data-canvas-ready="true"]')).toBeNull();
    expect(onLiveChange).not.toHaveBeenCalledWith(true);

    act(() => h.callbacks.current?.onApplied(2)); // the current revision lands
    expect(container.querySelector('[data-canvas-ready="true"]')).not.toBeNull();
    expect(onLiveChange).toHaveBeenCalledWith(true);
  });

  it('falls back to DOM on a structured error (iframe removed, live never flips)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container, onLiveChange } = renderBoard();
    act(() => h.callbacks.current?.onError('boot', 'wasm fetch failed'));
    expect(container.querySelector('iframe.godot-board')).toBeNull();
    expect(onLiveChange).not.toHaveBeenCalledWith(true);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('falling back to DOM'));
    // A late applied after the failure must not revive the dead frame.
    expect(() => h.callbacks.current?.onApplied(h.state.revision)).not.toThrow();
    expect(container.querySelector('iframe.godot-board')).toBeNull();
  });

  it('falls back on a pre-session boot error (empty sessionId)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = renderBoard();
    act(() => h.callbacks.current?.onError('boot', 'shell missing'));
    expect(container.querySelector('iframe.godot-board')).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('(boot)'));
  });

  it('disposes the session on unmount', () => {
    const { unmount } = renderBoard();
    unmount();
    // The real transport's dispose() internally requests the frame quit
    // (sendDispose) — that contract is pinned in tests/godot-transport.test.ts;
    // the wrapper contract is one dispose per mount.
    expect(h.transport.dispose).toHaveBeenCalledTimes(1);
  });

  it('sends nothing before a valid measurement', () => {
    renderBoard({ ...LAYOUT, measured: false, rects: [] });
    expect(h.sends).toHaveLength(0);
  });

  it('re-sends on re-measurement without recreating the session', () => {
    const { rerender } = renderBoard();
    const sendsAtMount = h.sends.length;
    const nextRects = [{ x: 8, y: 18, width: 96, height: 134.4 }];
    rerender(<GodotBoard layout={{ ...LAYOUT, rects: nextRects }} />);
    expect(h.sends.length).toBe(sendsAtMount + 1);
    const last = h.sends[h.sends.length - 1] as { projection: { room: Array<{ x: number }> } };
    expect(last.projection.room[0]?.x).toBe(8);
  });
});
