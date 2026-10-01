import type { BoardProjection } from './board-protocol';
import { PROTOCOL_VERSION, parseFrameToHost, parseHostToFrame } from './board-protocol';

/**
 * Session-scoped message transport between the React host and the Godot frame
 * (godot-plan.md lifecycle, step 2: "Each mount gets a fresh session
 * identifier and disposal flag").
 *
 * - Owns the sessionId and the monotonic revision counter for ONE board
 *   mount; a new mount creates a new transport, so late messages from an old
 *   frame can never be mistaken for the current session (session check on
 *   every inbound message).
 * - postMessage only with an explicit target origin — the frame is
 *   same-origin, so the host origin is the target; `'*'` is never used.
 * - Validates every message it sends AND receives (board-protocol parsers),
 *   so a malformed frame message is dropped, not dispatched.
 * - Idempotent dispose: removes the listener, sends `dispose` at most once.
 *
 * The transport is deliberately dumb about projections and lifecycle — the
 * owner (GodotBoard) decides WHAT to send and WHEN to promote/fall back.
 */

export interface GodotTransportCallbacks {
  /** The frame rendered the given revision of THIS session. */
  onApplied(revision: number): void;
  /** Structured fatal failure — the host must fall back to DOM. */
  onError(code: string, message: string): void;
}

export interface GodotTransport {
  readonly sessionId: string;
  /** The latest revision handed to sendSync (0 before the first sync). */
  readonly lastRevision: number;
  sendSync(projection: BoardProjection): void;
  sendDispose(): void;
  /** Remove listeners and stop delivery. Idempotent. After dispose, no-ops. */
  dispose(): void;
}

function createSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function attachGodotTransport(
  getFrameWindow: () => Window | null,
  callbacks: GodotTransportCallbacks,
): GodotTransport {
  const sessionId = createSessionId();
  let revision = 0;
  let disposed = false;
  let disposeSent = false;

  const onMessage = (event: MessageEvent): void => {
    if (disposed) return;
    if (event.source !== getFrameWindow()) return;
    // Same-origin frame: the parent's origin is both the expected source and
    // the target origin of every outbound message.
    if (event.origin !== window.location.origin) return;
    let parsed: unknown;
    try {
      parsed = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
    } catch {
      return; // non-JSON noise — drop
    }
    const message = parseFrameToHost(parsed);
    if (message === null) return;
    if (message.kind === 'applied') {
      if (message.sessionId !== sessionId) return; // stale/foreign session
      callbacks.onApplied(message.revision);
      return;
    }
    // error: sessionId may be empty (boot failure before the frame saw a sync)
    if (message.sessionId === '' || message.sessionId === sessionId) {
      callbacks.onError(message.code, message.message);
    }
  };

  window.addEventListener('message', onMessage);

  const post = (message: HostMessageShape): void => {
    const frameWindow = getFrameWindow();
    if (frameWindow === null || disposed) return;
    frameWindow.postMessage(JSON.stringify(message), window.location.origin);
  };

  type HostMessageShape =
    | {
        kind: 'sync';
        protocolVersion: number;
        sessionId: string;
        revision: number;
        projection: BoardProjection;
      }
    | { kind: 'dispose'; protocolVersion: number; sessionId: string };

  return {
    sessionId,
    get lastRevision(): number {
      return revision;
    },
    sendSync(projection) {
      if (disposed) return;
      revision += 1;
      const message = {
        kind: 'sync' as const,
        protocolVersion: PROTOCOL_VERSION,
        sessionId,
        revision,
        projection,
      };
      // Never emit an invalid envelope, even if the projection builder lied.
      if (parseHostToFrame(message) === null) {
        revision -= 1;
        return;
      }
      post(message);
    },
    sendDispose() {
      if (disposed || disposeSent) return;
      disposeSent = true;
      post({ kind: 'dispose', protocolVersion: PROTOCOL_VERSION, sessionId });
    },
    dispose() {
      if (disposed) return;
      // Request the graceful quit BEFORE going deaf: post() refuses to send
      // once disposed, so the flag must flip after the dispose message.
      this.sendDispose();
      disposed = true;
      window.removeEventListener('message', onMessage);
    },
  };
}
