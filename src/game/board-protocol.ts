import type { CardId } from '../engine';

/**
 * Phase 2 wire protocol between the React host and the Godot web frame — the
 * full envelope from godot-plan.md "Transport contract and synchronization"
 * (still protocol version 1; Phase 1 shipped the minimal subset of it).
 *
 *   host → frame : `sync` (complete latest truth; latest-wins), `hover`
 *                  (transient, not replayed), `policy` (motion/visibility),
 *                  `dispose`
 *   frame → host : `bridge-ready` (transport available), `applied` (a rendered
 *                  revision), `settled` (revision has no active choreography),
 *                  `diagnostics` (test/dev sprite rects), `error`
 *
 * Ordering fields:
 *   - `revision` orders transport updates (host-monotonic per session).
 *   - `runGeneration` distinguishes run starts/replacements even when `fxSeq`
 *     and seed are unchanged. Host-derived: a startRun (including an explicit
 *     seeded URL) bumps it; a hydrate resume must not (the discriminator is
 *     the store's `runResumed`).
 *   - `layoutRevision` orders authoritative-layout changes (bumped whenever
 *     the rect set identity changes).
 *   - `fxSeq` identifies action notifications; one fxSeq gets at most one
 *     action effect, including invalid actions that leave state unchanged.
 *
 * Validation is strict on BOTH ends; `board-protocol.ts` stays Godot/store-free.
 * Geometry: rects are CSS px relative to the `.room` border box — the exact
 * box the frame's iframe covers, and the space computeBoardLayout speaks.
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

/** Shared envelope head for everything that addresses a session. */
export interface EnvelopeHead {
  protocolVersion: number;
  buildId: string;
  sessionId: string;
}

/** host → frame — the full Phase 2 sync envelope. */
export interface SyncMessage extends EnvelopeHead {
  kind: 'sync';
  revision: number;
  runGeneration: number;
  layoutRevision: number;
  /** Action-notification identity (store fxSeq); 0 before any action. */
  fxSeq: number;
  projection: BoardProjection;
  /** Test/dev opt-in: the frame appends sprite-rect diagnostics to applied. */
  diagnostics: boolean;
}

/** host → frame — transient hover change; ignored for missing cards; NOT replayed. */
export interface HoverMessage extends EnvelopeHead {
  kind: 'hover';
  cardId: CardId;
  over: boolean;
}

/** host → frame — motion/visibility policy; the frame snaps/cancels as needed. */
export interface PolicyMessage extends EnvelopeHead {
  kind: 'policy';
  reducedMotion: boolean;
}

/** host → frame — stop accepting updates and request quit. */
export interface DisposeMessage extends EnvelopeHead {
  kind: 'dispose';
}

export type HostToFrameMessage = SyncMessage | HoverMessage | PolicyMessage | DisposeMessage;

/** frame → host — callback registered and textures prepared; host sends state. */
export interface BridgeReadyMessage extends EnvelopeHead {
  kind: 'bridge-ready';
}

/** frame → host — a rendered revision acknowledgement (echoes the ordering fields). */
export interface AppliedMessage extends EnvelopeHead {
  kind: 'applied';
  revision: number;
  runGeneration: number;
  layoutRevision: number;
}

/** frame → host — the revision has no active room choreography (test/dev aid). */
export interface SettledMessage extends EnvelopeHead {
  kind: 'settled';
  revision: number;
  runGeneration: number;
  layoutRevision: number;
}

/** frame → host — rendered sprite bounds for parity checks (test/dev only). */
export interface DiagnosticsMessage extends EnvelopeHead {
  kind: 'diagnostics';
  revision: number;
  runGeneration: number;
  layoutRevision: number;
  /** Rendered rects in room-box CSS px, one per live sprite. */
  rects: ProjectionCard[];
}

/** frame → host — structured fatal failure; the host must fall back to DOM. */
export interface ErrorMessage extends EnvelopeHead {
  kind: 'error';
  code: 'boot' | 'non-web' | 'protocol' | 'asset' | 'runtime';
  message: string;
}

export type FrameToHostMessage =
  BridgeReadyMessage | AppliedMessage | SettledMessage | DiagnosticsMessage | ErrorMessage;

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

function isPositiveInt(value: unknown, min: number): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value >= min;
}

function isSessionId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 128;
}

function isBuildId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 64;
}

function parseHead(value: Record<string, unknown>): EnvelopeHead | null {
  if (value.protocolVersion !== PROTOCOL_VERSION) return null;
  if (!isSessionId(value.sessionId) || !isBuildId(value.buildId)) return null;
  return {
    protocolVersion: PROTOCOL_VERSION,
    buildId: value.buildId,
    sessionId: value.sessionId,
  };
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

function parseOrdered(
  value: Record<string, unknown>,
): { revision: number; runGeneration: number; layoutRevision: number } | null {
  if (!isPositiveInt(value.revision, 1)) return null;
  if (!isPositiveInt(value.runGeneration, 1)) return null;
  if (!isPositiveInt(value.layoutRevision, 1)) return null;
  return {
    revision: value.revision,
    runGeneration: value.runGeneration,
    layoutRevision: value.layoutRevision,
  };
}

/**
 * Validate one host→frame message (unknown data, e.g. off the wire).
 * Returns null when the message must be dropped.
 */
export function parseHostToFrame(value: unknown): HostToFrameMessage | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  const head = parseHead(v);
  if (head === null) return null;
  switch (v.kind) {
    case 'sync': {
      const ordered = parseOrdered(v);
      if (ordered === null) return null;
      if (!isPositiveInt(v.fxSeq, 0)) return null;
      if (typeof v.diagnostics !== 'boolean') return null;
      const projection = parseProjection(v.projection);
      if (projection === null) return null;
      return {
        kind: 'sync',
        ...head,
        ...ordered,
        fxSeq: v.fxSeq,
        diagnostics: v.diagnostics,
        projection,
      };
    }
    case 'hover': {
      if (!isCardId(v.cardId) || typeof v.over !== 'boolean') return null;
      return { kind: 'hover', ...head, cardId: v.cardId, over: v.over };
    }
    case 'policy': {
      if (typeof v.reducedMotion !== 'boolean') return null;
      return { kind: 'policy', ...head, reducedMotion: v.reducedMotion };
    }
    case 'dispose':
      return { kind: 'dispose', ...head };
    default:
      return null;
  }
}

/**
 * Validate one frame→host message. `error` tolerates an empty sessionId
 * (boot failures happen before the frame learns the session) — its head
 * check is relaxed accordingly.
 */
export function parseFrameToHost(value: unknown): FrameToHostMessage | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (v.protocolVersion !== PROTOCOL_VERSION) return null;
  switch (v.kind) {
    case 'bridge-ready':
    case 'applied':
    case 'settled':
    case 'diagnostics': {
      if (!isSessionId(v.sessionId) || !isBuildId(v.buildId)) return null;
      const head: EnvelopeHead = {
        protocolVersion: PROTOCOL_VERSION,
        buildId: v.buildId,
        sessionId: v.sessionId,
      };
      if (v.kind === 'bridge-ready') return { kind: 'bridge-ready', ...head };
      const ordered = parseOrdered(v);
      if (ordered === null) return null;
      if (v.kind === 'applied') return { kind: 'applied', ...head, ...ordered };
      if (v.kind === 'settled') return { kind: 'settled', ...head, ...ordered };
      // diagnostics: rendered rects, bounded like a projection room.
      if (!Array.isArray(v.rects) || v.rects.length > MAX_PROJECTION_CARDS) return null;
      const rects: ProjectionCard[] = [];
      for (const entry of v.rects) {
        if (typeof entry !== 'object' || entry === null) return null;
        const e = entry as Record<string, unknown>;
        if (
          !isCardId(e.cardId) ||
          !isFiniteNumber(e.x) ||
          !isFiniteNumber(e.y) ||
          !isFiniteNumber(e.width) ||
          !isFiniteNumber(e.height)
        ) {
          return null;
        }
        rects.push({ cardId: e.cardId, x: e.x, y: e.y, width: e.width, height: e.height });
      }
      return { kind: 'diagnostics', ...head, ...ordered, rects };
    }
    case 'error': {
      const sessionId = v.sessionId;
      if (typeof sessionId !== 'string' || sessionId.length > 128) return null;
      if (!isBuildId(v.buildId)) return null;
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
        protocolVersion: PROTOCOL_VERSION,
        buildId: v.buildId,
        sessionId,
        code,
        message: v.message,
      };
    }
    default:
      return null;
  }
}
