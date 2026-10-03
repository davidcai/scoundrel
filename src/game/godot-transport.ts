import type { CardId } from '../engine';
import type { BoardProjection } from './board-protocol';
import { PROTOCOL_VERSION, parseFrameToHost, parseHostToFrame } from './board-protocol';

/**
 * Session-scoped message transport between the React host and the Godot frame
 * (godot-plan.md "Transport contract and synchronization", Phase 2 envelope).
 *
 * - Owns the sessionId and the `revision` counter for ONE board mount; a new
 *   mount creates a new transport, so late messages from an old frame can
 *   never be mistaken for the current session (session check on every inbound
 *   message). `runGeneration` / `layoutRevision` are ordering inputs supplied
 *   by the owner per send; the transport records the last sent triple so the
 *   owner can gate acknowledgements against exactly what went out.
 * - postMessage only with an explicit target origin — the frame is
 *   same-origin, so the host origin is the target; `'*'` is never used.
 * - Validates every message it sends AND receives (board-protocol parsers),
 *   so a malformed frame message is dropped, not dispatched.
 * - Idempotent dispose: removes the listener, sends `dispose` at most once.
 *
 * The transport is deliberately dumb about projections, generations, and
 * lifecycle — the owner (GodotBoard) decides WHAT to send and WHEN to
 * promote/fall back.
 */

export interface GodotTransportCallbacks {
  /** The frame's sink is registered; the host starts/continues sending. */
  onBridgeReady(): void;
  /** The frame rendered the given ordered triple of THIS session. */
  onApplied(revision: number, runGeneration: number, layoutRevision: number): void;
  /** The revision has no active room choreography (test/dev aid). */
  onSettled(revision: number, runGeneration: number, layoutRevision: number): void;
  /** Rendered sprite bounds for parity checks (test/dev only). */
  onDiagnostics(
    revision: number,
    runGeneration: number,
    layoutRevision: number,
    rects: BoardProjection['room'],
  ): void;
  /** Structured fatal failure — the host must fall back to DOM. */
  onError(code: string, message: string): void;
}

export interface SendSyncInput {
  projection: BoardProjection;
  runGeneration: number;
  layoutRevision: number;
  fxSeq: number;
  diagnostics: boolean;
}

export interface GodotTransport {
  readonly sessionId: string;
  /** The ordered triple of the last sendSync (0/1/1 before the first sync). */
  readonly lastSent: { revision: number; runGeneration: number; layoutRevision: number };
  sendSync(input: SendSyncInput): void;
  sendHover(cardId: CardId, over: boolean): void;
  sendPolicy(reducedMotion: boolean): void;
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
  buildId: string,
  getFrameWindow: () => Window | null,
  callbacks: GodotTransportCallbacks,
): GodotTransport {
  const sessionId = createSessionId();
  let revision = 0;
  let sentRunGeneration = 1;
  let sentLayoutRevision = 1;
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
    if (message.sessionId !== '' && message.sessionId !== sessionId) return; // stale/foreign
    switch (message.kind) {
      case 'bridge-ready':
        callbacks.onBridgeReady();
        return;
      case 'applied':
        callbacks.onApplied(message.revision, message.runGeneration, message.layoutRevision);
        return;
      case 'settled':
        callbacks.onSettled(message.revision, message.runGeneration, message.layoutRevision);
        return;
      case 'diagnostics':
        callbacks.onDiagnostics(
          message.revision,
          message.runGeneration,
          message.layoutRevision,
          message.rects,
        );
        return;
      case 'error':
        // sessionId may be empty (boot failure before the frame saw a sync)
        callbacks.onError(message.code, message.message);
        return;
    }
  };

  window.addEventListener('message', onMessage);

  type OutboundMessage =
    | {
        kind: 'sync';
        protocolVersion: number;
        buildId: string;
        sessionId: string;
        revision: number;
        runGeneration: number;
        layoutRevision: number;
        fxSeq: number;
        diagnostics: boolean;
        projection: BoardProjection;
      }
    | {
        kind: 'hover';
        protocolVersion: number;
        buildId: string;
        sessionId: string;
        cardId: CardId;
        over: boolean;
      }
    | {
        kind: 'policy';
        protocolVersion: number;
        buildId: string;
        sessionId: string;
        reducedMotion: boolean;
      }
    | { kind: 'dispose'; protocolVersion: number; buildId: string; sessionId: string };

  const post = (message: OutboundMessage): void => {
    const frameWindow = getFrameWindow();
    if (frameWindow === null || disposed) return;
    frameWindow.postMessage(JSON.stringify(message), window.location.origin);
  };

  return {
    sessionId,
    get lastSent(): GodotTransport['lastSent'] {
      return { revision, runGeneration: sentRunGeneration, layoutRevision: sentLayoutRevision };
    },
    sendSync(input) {
      if (disposed) return;
      const candidate = {
        kind: 'sync' as const,
        protocolVersion: PROTOCOL_VERSION,
        buildId,
        sessionId,
        revision: revision + 1,
        runGeneration: input.runGeneration,
        layoutRevision: input.layoutRevision,
        fxSeq: input.fxSeq,
        diagnostics: input.diagnostics,
        projection: input.projection,
      };
      // Never emit an invalid envelope, even if the projection builder lied.
      if (parseHostToFrame(candidate) === null) return;
      revision += 1;
      sentRunGeneration = input.runGeneration;
      sentLayoutRevision = input.layoutRevision;
      post(candidate);
    },
    sendHover(cardId, over) {
      if (disposed) return;
      post({
        kind: 'hover',
        protocolVersion: PROTOCOL_VERSION,
        buildId,
        sessionId,
        cardId,
        over,
      });
    },
    sendPolicy(reducedMotion) {
      if (disposed) return;
      post({
        kind: 'policy',
        protocolVersion: PROTOCOL_VERSION,
        buildId,
        sessionId,
        reducedMotion,
      });
    },
    sendDispose() {
      if (disposed || disposeSent) return;
      disposeSent = true;
      post({ kind: 'dispose', protocolVersion: PROTOCOL_VERSION, buildId, sessionId });
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
