import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BoardProjection } from '../src/game/board-protocol';
import { attachGodotTransport, type GodotTransport } from '../src/game/godot-transport';

/**
 * Real-transport tests for the frame messaging (godot-plan.md, "Transport
 * contract and synchronization" — Phase 1 subset): envelope serialization,
 * origin/source/session filtering on the inbound path, invalid-envelope
 * rejection before posting, dispose idempotency, and post-dispose silence.
 *
 * No iframe is loaded: the frame window is a postMessage mock, and inbound
 * frame messages are synthetic MessageEvents carrying the exact shapes the
 * shell produces.
 */

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
  onApplied: ReturnType<typeof vi.fn>;
  onError: ReturnType<typeof vi.fn>;
  /** Simulate a message arriving FROM the frame window. */
  deliverFromFrame(data: unknown, overrides?: { origin?: string; source?: unknown }): void;
}

function setup(): Harness {
  const frameWindow = frameWindowMock();
  const onApplied = vi.fn();
  const onError = vi.fn();
  const transport = attachGodotTransport(() => frameWindow as unknown as Window, {
    onApplied,
    onError,
  });
  return {
    frameWindow,
    transport,
    onApplied,
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

describe('attachGodotTransport (real module)', () => {
  let harness: Harness;

  beforeEach(() => {
    harness = setup();
  });

  afterEach(() => {
    harness.transport.dispose();
  });

  it('posts the sync envelope as JSON with an explicit same-origin target', () => {
    harness.transport.sendSync(projection());
    expect(harness.frameWindow.postMessage).toHaveBeenCalledTimes(1);
    const [data, targetOrigin] = harness.frameWindow.postMessage.mock.calls[0] as [string, string];
    expect(targetOrigin).toBe(window.location.origin);
    const envelope = JSON.parse(data) as Record<string, unknown>;
    expect(envelope).toMatchObject({
      kind: 'sync',
      protocolVersion: 1,
      sessionId: harness.transport.sessionId,
      revision: 1,
    });
  });

  it('bumps the revision per sync and rolls it back for an invalid projection', () => {
    harness.transport.sendSync(projection());
    expect(harness.transport.lastRevision).toBe(1);
    const before = harness.frameWindow.postMessage.mock.calls.length;
    // An invalid projection (zero width) must never reach the wire.
    harness.transport.sendSync({
      ...projection(),
      room: [{ cardId: 'club-8', x: 0, y: 0, width: 0, height: 268.8 }],
    });
    expect(harness.frameWindow.postMessage.mock.calls.length).toBe(before);
    expect(harness.transport.lastRevision).toBe(1);
  });

  it('acknowledges an applied message from the current session', () => {
    harness.transport.sendSync(projection());
    harness.deliverFromFrame(
      JSON.stringify({
        kind: 'applied',
        protocolVersion: 1,
        sessionId: harness.transport.sessionId,
        revision: 1,
      }),
    );
    expect(harness.onApplied).toHaveBeenCalledWith(1);
    expect(harness.onError).not.toHaveBeenCalled();
  });

  it('rejects applied messages from a foreign session, origin, or source', () => {
    harness.transport.sendSync(projection());
    harness.deliverFromFrame(
      JSON.stringify({ kind: 'applied', protocolVersion: 1, sessionId: 'sess-other', revision: 1 }),
    );
    harness.deliverFromFrame(
      JSON.stringify({
        kind: 'applied',
        protocolVersion: 1,
        sessionId: harness.transport.sessionId,
        revision: 1,
      }),
      { origin: 'https://evil.example' },
    );
    harness.deliverFromFrame(
      JSON.stringify({
        kind: 'applied',
        protocolVersion: 1,
        sessionId: harness.transport.sessionId,
        revision: 1,
      }),
      { source: {} },
    );
    expect(harness.onApplied).not.toHaveBeenCalled();
  });

  it('surfaces structured errors, including pre-session boot errors', () => {
    harness.deliverFromFrame(
      JSON.stringify({
        kind: 'error',
        protocolVersion: 1,
        sessionId: '',
        code: 'boot',
        message: 'wasm fetch failed',
      }),
    );
    expect(harness.onError).toHaveBeenCalledWith('boot', 'wasm fetch failed');
  });

  it('drops malformed and unknown frame messages', () => {
    harness.deliverFromFrame('not json');
    harness.deliverFromFrame(JSON.stringify({ kind: 'hover' }));
    harness.deliverFromFrame(42);
    expect(harness.onApplied).not.toHaveBeenCalled();
    expect(harness.onError).not.toHaveBeenCalled();
  });

  it('sends dispose at most once and goes silent afterwards', () => {
    harness.transport.sendSync(projection());
    harness.transport.dispose();
    harness.transport.dispose(); // idempotent
    harness.transport.sendSync(projection()); // no-op after dispose

    const kinds = harness.frameWindow.postMessage.mock.calls.map(
      ([data]) => (JSON.parse(data as string) as { kind: string }).kind,
    );
    expect(kinds).toEqual(['sync', 'dispose']); // exactly one dispose, no post-dispose sync

    // A late frame message cannot revive a disposed transport.
    harness.deliverFromFrame(
      JSON.stringify({
        kind: 'applied',
        protocolVersion: 1,
        sessionId: harness.transport.sessionId,
        revision: 1,
      }),
    );
    expect(harness.onApplied).not.toHaveBeenCalled();
  });
});
