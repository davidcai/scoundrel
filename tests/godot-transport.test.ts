import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BoardProjection } from '../src/game/board-protocol';
import { attachGodotTransport, type GodotTransport } from '../src/game/godot-transport';

/**
 * Real-transport tests for the frame messaging (godot-plan.md, "Transport
 * contract and synchronization" — Phase 2 envelope): envelope serialization
 * incl. the ordered triple, origin/source/session filtering on the inbound
 * path, invalid-envelope rejection before posting, dispose idempotency, and
 * post-dispose silence.
 *
 * No iframe is loaded: the frame window is a postMessage mock, and inbound
 * frame messages are synthetic MessageEvents carrying the exact shapes the
 * shell produces.
 */

const BUILD_ID = 'spike';

function projection(): BoardProjection {
  return {
    room: [{ cardId: 'club-8', x: 0, y: 0, width: 192, height: 268.8 }],
    selectedCardId: null,
    carriedCardId: null,
    phase: 'playing',
    reducedMotion: false,
  };
}

function frameWindowMock(): { postMessage: ReturnType<typeof vi.fn> } {
  return { postMessage: vi.fn() };
}

interface Harness {
  frameWindow: { postMessage: ReturnType<typeof vi.fn> };
  transport: GodotTransport;
  onBridgeReady: ReturnType<typeof vi.fn>;
  onApplied: ReturnType<typeof vi.fn>;
  onSettled: ReturnType<typeof vi.fn>;
  onDiagnostics: ReturnType<typeof vi.fn>;
  onError: ReturnType<typeof vi.fn>;
  /** Simulate a message arriving FROM the frame window. */
  deliverFromFrame(data: unknown, overrides?: { origin?: string; source?: unknown }): void;
}

function setup(): Harness {
  const frameWindow = frameWindowMock();
  const onBridgeReady = vi.fn();
  const onApplied = vi.fn();
  const onSettled = vi.fn();
  const onDiagnostics = vi.fn();
  const onError = vi.fn();
  const transport = attachGodotTransport(BUILD_ID, () => frameWindow as unknown as Window, {
    onBridgeReady,
    onApplied,
    onSettled,
    onDiagnostics,
    onError,
  });
  return {
    frameWindow,
    transport,
    onBridgeReady,
    onApplied,
    onSettled,
    onDiagnostics,
    onError,
    deliverFromFrame(data, overrides = {}) {
      const event = new MessageEvent('message', {
        source: (overrides.source ?? frameWindow) as Window,
        origin: overrides.origin ?? window.location.origin,
        data,
      });
      window.dispatchEvent(event);
    },
  };
}

function sentEnvelopes(harness: Harness): Array<Record<string, unknown>> {
  return harness.frameWindow.postMessage.mock.calls.map(
    ([data]) => JSON.parse(data as string) as Record<string, unknown>,
  );
}

describe('attachGodotTransport (real module)', () => {
  let harness: Harness;

  beforeEach(() => {
    harness = setup();
  });

  afterEach(() => {
    harness.transport.dispose();
  });

  it('posts the sync envelope as JSON with an explicit same-origin target', () => {
    harness.transport.sendSync({
      projection: projection(),
      runGeneration: 2,
      layoutRevision: 3,
      fxSeq: 7,
      diagnostics: true,
    });
    expect(harness.frameWindow.postMessage).toHaveBeenCalledTimes(1);
    const [data, targetOrigin] = harness.frameWindow.postMessage.mock.calls[0] as [string, string];
    expect(targetOrigin).toBe(window.location.origin);
    const envelope = JSON.parse(data) as Record<string, unknown>;
    expect(envelope).toMatchObject({
      kind: 'sync',
      protocolVersion: 1,
      buildId: BUILD_ID,
      sessionId: harness.transport.sessionId,
      revision: 1,
      runGeneration: 2,
      layoutRevision: 3,
      fxSeq: 7,
      diagnostics: true,
    });
    expect(harness.transport.lastSent).toEqual({
      revision: 1,
      runGeneration: 2,
      layoutRevision: 3,
    });
  });

  it('bumps the revision per sync and rolls it back for an invalid projection', () => {
    harness.transport.sendSync({
      projection: projection(),
      runGeneration: 1,
      layoutRevision: 1,
      fxSeq: 0,
      diagnostics: false,
    });
    expect(harness.transport.lastSent.revision).toBe(1);
    const before = harness.frameWindow.postMessage.mock.calls.length;
    // An invalid projection (zero width) must never reach the wire.
    harness.transport.sendSync({
      projection: {
        ...projection(),
        room: [{ cardId: 'club-8', x: 0, y: 0, width: 0, height: 268.8 }],
      },
      runGeneration: 1,
      layoutRevision: 1,
      fxSeq: 0,
      diagnostics: false,
    });
    expect(harness.frameWindow.postMessage.mock.calls.length).toBe(before);
    expect(harness.transport.lastSent.revision).toBe(1);
  });

  it('sends hover and policy envelopes on the same session', () => {
    harness.transport.sendHover('heart-9', true);
    harness.transport.sendPolicy(true);
    const kinds = sentEnvelopes(harness).map((e) => e.kind);
    expect(kinds).toEqual(['hover', 'policy']);
    const hover = sentEnvelopes(harness)[0];
    expect(hover).toMatchObject({
      kind: 'hover',
      buildId: BUILD_ID,
      sessionId: harness.transport.sessionId,
      cardId: 'heart-9',
      over: true,
    });
    const policy = sentEnvelopes(harness)[1];
    expect(policy).toMatchObject({ kind: 'policy', reducedMotion: true });
  });

  it('acknowledges applied/settled/diagnostics/bridge-ready from the current session', () => {
    harness.transport.sendSync({
      projection: projection(),
      runGeneration: 2,
      layoutRevision: 3,
      fxSeq: 0,
      diagnostics: true,
    });
    harness.deliverFromFrame(
      JSON.stringify({
        kind: 'bridge-ready',
        protocolVersion: 1,
        buildId: BUILD_ID,
        sessionId: harness.transport.sessionId,
      }),
    );
    harness.deliverFromFrame(
      JSON.stringify({
        kind: 'applied',
        protocolVersion: 1,
        buildId: BUILD_ID,
        sessionId: harness.transport.sessionId,
        revision: 1,
        runGeneration: 2,
        layoutRevision: 3,
      }),
    );
    harness.deliverFromFrame(
      JSON.stringify({
        kind: 'settled',
        protocolVersion: 1,
        buildId: BUILD_ID,
        sessionId: harness.transport.sessionId,
        revision: 1,
        runGeneration: 2,
        layoutRevision: 3,
      }),
    );
    harness.deliverFromFrame(
      JSON.stringify({
        kind: 'diagnostics',
        protocolVersion: 1,
        buildId: BUILD_ID,
        sessionId: harness.transport.sessionId,
        revision: 1,
        runGeneration: 2,
        layoutRevision: 3,
        rects: [{ cardId: 'club-8', x: 0, y: 0, width: 192, height: 268.8 }],
      }),
    );
    expect(harness.onBridgeReady).toHaveBeenCalledTimes(1);
    expect(harness.onApplied).toHaveBeenCalledWith(1, 2, 3);
    expect(harness.onSettled).toHaveBeenCalledWith(1, 2, 3);
    expect(harness.onDiagnostics).toHaveBeenCalledWith(1, 2, 3, [
      { cardId: 'club-8', x: 0, y: 0, width: 192, height: 268.8 },
    ]);
  });

  it('rejects frame messages from a foreign session, origin, or source', () => {
    const applied = (sessionId: string): string =>
      JSON.stringify({
        kind: 'applied',
        protocolVersion: 1,
        buildId: BUILD_ID,
        sessionId,
        revision: 1,
        runGeneration: 1,
        layoutRevision: 1,
      });

    harness.deliverFromFrame(applied('sess-other')); // stale session (previous mount)
    harness.deliverFromFrame(applied(harness.transport.sessionId), {
      origin: 'https://evil.example',
    });
    harness.deliverFromFrame(applied(harness.transport.sessionId), { source: {} });
    expect(harness.onApplied).not.toHaveBeenCalled();

    harness.deliverFromFrame(applied(harness.transport.sessionId));
    expect(harness.onApplied).toHaveBeenCalledTimes(1);
  });

  it('surfaces structured errors, including pre-session boot errors', () => {
    harness.deliverFromFrame(
      JSON.stringify({
        kind: 'error',
        protocolVersion: 1,
        buildId: BUILD_ID,
        sessionId: '',
        code: 'boot',
        message: 'wasm fetch failed',
      }),
    );
    expect(harness.onError).toHaveBeenCalledWith('boot', 'wasm fetch failed');
  });

  it('drops malformed and unknown frame messages', () => {
    harness.deliverFromFrame('not json');
    harness.deliverFromFrame(JSON.stringify({ kind: 'hover' })); // host→frame kind from the frame
    harness.deliverFromFrame(42);
    expect(harness.onApplied).not.toHaveBeenCalled();
    expect(harness.onError).not.toHaveBeenCalled();
  });

  it('sends dispose at most once and goes silent afterwards', () => {
    harness.transport.sendSync({
      projection: projection(),
      runGeneration: 1,
      layoutRevision: 1,
      fxSeq: 0,
      diagnostics: false,
    });
    harness.transport.dispose();
    harness.transport.dispose(); // idempotent
    harness.transport.sendSync({
      projection: projection(),
      runGeneration: 1,
      layoutRevision: 1,
      fxSeq: 0,
      diagnostics: false,
    });

    const kinds = sentEnvelopes(harness).map((e) => e.kind);
    expect(kinds).toEqual(['sync', 'dispose']); // exactly one dispose, no post-dispose sync

    // A late frame message cannot revive a disposed transport.
    harness.deliverFromFrame(
      JSON.stringify({
        kind: 'applied',
        protocolVersion: 1,
        buildId: BUILD_ID,
        sessionId: harness.transport.sessionId,
        revision: 1,
        runGeneration: 1,
        layoutRevision: 1,
      }),
    );
    expect(harness.onApplied).not.toHaveBeenCalled();
  });
});
