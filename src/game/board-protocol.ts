import type { CardId } from '../engine';

/**
 * Phase 1 wire protocol between the React host and the Godot web frame
 * (godot-plan.md, "Transport contract and synchronization").
 *
 * This is the plan's MINIMAL Phase 1 subset — deliberately smaller than the
 * Phase 2 target envelope:
 *
 *   host → frame : `sync` (complete latest visual truth; latest-wins), `dispose`
 *   frame → host : `applied` (a rendered revision was displayed; the first one
 *                  promotes the canvas live), `error` (fatal; host falls back)
 *
 * The Phase 2 envelope (`runGeneration`/`layoutRevision`/`fxSeq`, `hover`,
 * `policy`, `bridge-ready`, `settled`, `diagnostics`) slots into these shapes
 * later; nothing on the wire references the engine, the store, or Godot —
 * every payload is a JSON-safe visual DTO validated structurally on both ends
 * (origin/source/session checks live in the transport and the shell; this
 * module owns shape + bounds validation).
 *
 * Geometry contract: rects are CSS pixels relative to the `.room` BORDER box —
 * the exact box the frame's iframe covers (`position: absolute; inset: 0`),
 * and the same space `computeBoardLayout` + `useBoardLayout` already speak.
 */

export const PROTOCOL_VERSION = 1;

/** The room never holds more than 4 cards (board-layout MAX_ROOM_CARDS). */
export const MAX_PROJECTION_CARDS = 4;

export interface ProjectionCard {
  cardId: CardId;
  /** Rect in CSS px relative to the room border box. */
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The complete visual truth one `sync` carries. JSON-safe, bounded. */
export interface BoardProjection {
  room: ProjectionCard[];
  selectedCardId: CardId | null;
  carriedCardId: CardId | null;
  phase: 'playing' | 'won' | 'lost';
  /** Effective reduced motion: stored preference OR prefers-reduced-motion. */
  reducedMotion: boolean;
}

/** host → frame */
export interface SyncMessage {
  kind: 'sync';
  protocolVersion: number;
  sessionId: string;
  revision: number;
  projection: BoardProjection;
}

/** host → frame — stop accepting updates and quit. */
export interface DisposeMessage {
  kind: 'dispose';
  protocolVersion: number;
  sessionId: string;
}

/** frame → host — a rendered revision acknowledgement. */
export interface AppliedMessage {
  kind: 'applied';
  protocolVersion: number;
  sessionId: string;
  revision: number;
}

/** frame → host — structured fatal failure; the host must fall back to DOM. */
export interface ErrorMessage {
  kind: 'error';
  protocolVersion: number;
  /** May be empty for pre-session boot failures (engine did not start). */
  sessionId: string;
  code: 'boot' | 'non-web' | 'protocol' | 'asset' | 'runtime';
  message: string;
}

export type HostToFrameMessage = SyncMessage | DisposeMessage;
export type FrameToHostMessage = AppliedMessage | ErrorMessage;

const SUITS: readonly string[] = ['club', 'diamond', 'heart', 'spade'];
const RANKS: readonly string[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'j', 'q', 'k', 'a'];

/** Structural CardId check (`${suit}-${rank}`, matching the artwork filenames). */
export function isCardId(value: unknown): value is CardId {
  if (typeof value !== 'string') return false;
  const dash = value.indexOf('-');
  if (dash <= 0 || dash !== value.lastIndexOf('-')) return false;
  return SUITS.includes(value.slice(0, dash)) && RANKS.includes(value.slice(dash + 1));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isSessionId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 128;
}

function isProtocolVersion(value: unknown): value is number {
  return value === PROTOCOL_VERSION;
}

function parseProjection(value: unknown): BoardProjection | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (!Array.isArray(v.room) || v.room.length > MAX_PROJECTION_CARDS) return null;
  const seen = new Set<string>();
  const room: ProjectionCard[] = [];
  for (const entry of v.room) {
    if (typeof entry !== 'object' || entry === null) return null;
    const e = entry as Record<string, unknown>;
    if (
      !isCardId(e.cardId) ||
      !isFiniteNumber(e.x) ||
      !isFiniteNumber(e.y) ||
      !isFiniteNumber(e.width) ||
      !isFiniteNumber(e.height) ||
      e.width <= 0 ||
      e.height <= 0
    ) {
      return null;
    }
    // Duplicate identities are a protocol violation (one sprite per card).
    if (seen.has(e.cardId)) return null;
    seen.add(e.cardId);
    room.push({ cardId: e.cardId, x: e.x, y: e.y, width: e.width, height: e.height });
  }
  const selectedOk = v.selectedCardId === null || isCardId(v.selectedCardId);
  const carriedOk = v.carriedCardId === null || isCardId(v.carriedCardId);
  if (
    !selectedOk ||
    !carriedOk ||
    (v.phase !== 'playing' && v.phase !== 'won' && v.phase !== 'lost') ||
    typeof v.reducedMotion !== 'boolean'
  ) {
    return null;
  }
  return {
    room,
    selectedCardId: v.selectedCardId as CardId | null,
    carriedCardId: v.carriedCardId as CardId | null,
    phase: v.phase,
    reducedMotion: v.reducedMotion,
  };
}

function parseCommon(
  value: Record<string, unknown>,
): { protocolVersion: number; sessionId: string } | null {
  if (!isProtocolVersion(value.protocolVersion) || !isSessionId(value.sessionId)) return null;
  return { protocolVersion: value.protocolVersion, sessionId: value.sessionId };
}

/**
 * Validate one host→frame message (unknown data, e.g. off the wire).
 * Returns null when the message must be dropped.
 */
export function parseHostToFrame(value: unknown): HostToFrameMessage | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  switch (v.kind) {
    case 'sync': {
      const common = parseCommon(v);
      if (common === null) return null;
      const revision = v.revision;
      if (!isFiniteNumber(revision) || revision < 1 || !Number.isInteger(revision)) return null;
      const projection = parseProjection(v.projection);
      if (projection === null) return null;
      return { kind: 'sync', ...common, revision, projection };
    }
    case 'dispose': {
      const common = parseCommon(v);
      return common === null ? null : { kind: 'dispose', ...common };
    }
    default:
      return null;
  }
}

/**
 * Validate one frame→host message. `error` tolerates an empty sessionId
 * (boot failures happen before the frame learns the session).
 */
export function parseFrameToHost(value: unknown): FrameToHostMessage | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  switch (v.kind) {
    case 'applied': {
      const common = parseCommon(v);
      if (common === null) return null;
      const revision = v.revision;
      if (!isFiniteNumber(revision) || revision < 1 || !Number.isInteger(revision)) return null;
      return { kind: 'applied', ...common, revision };
    }
    case 'error': {
      if (!isProtocolVersion(v.protocolVersion)) return null;
      const sessionId = v.sessionId;
      if (typeof sessionId !== 'string' || sessionId.length > 128) return null;
      const code = v.code;
      if (
        code !== 'boot' &&
        code !== 'non-web' &&
        code !== 'protocol' &&
        code !== 'asset' &&
        code !== 'runtime'
      ) {
        return null;
      }
      if (typeof v.message !== 'string' || v.message.length > 512) return null;
      return {
        kind: 'error',
        protocolVersion: v.protocolVersion,
        sessionId,
        code,
        message: v.message,
      };
    }
    default:
      return null;
  }
}
