import { describe, expect, it } from 'vitest';
import type { BoardProjection } from '../src/game/board-protocol';
import {
  PROTOCOL_VERSION,
  isCardId,
  parseFrameToHost,
  parseHostToFrame,
} from '../src/game/board-protocol';

/**
 * Protocol tests (godot-plan.md §Test plan 2 — Phase 2 envelope): structural
 * validation on both ends of the frame boundary — malformed shapes, unknown
 * identities, non-finite geometry, bounds, and the ordering fields
 * (revision/runGeneration/layoutRevision/fxSeq). Sequencing behavior lives in
 * the transport/GodotBoard tests; these pin the wire format itself.
 */

const RECT = { x: 10, y: 20, width: 192, height: 268.8 };
const HEAD = { protocolVersion: PROTOCOL_VERSION, buildId: 'spike', sessionId: 'sess-abc' };

function projection(overrides: Record<string, unknown> = {}): BoardProjection {
  return {
    room: [{ cardId: 'club-8', ...RECT }],
    selectedCardId: null,
    carriedCardId: null,
    phase: 'playing',
    reducedMotion: false,
    ...overrides,
  } as BoardProjection;
}

function syncMessage(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    kind: 'sync',
    ...HEAD,
    revision: 1,
    runGeneration: 1,
    layoutRevision: 1,
    fxSeq: 0,
    diagnostics: false,
    projection: projection(),
    ...overrides,
  };
}

describe('isCardId', () => {
  it.each(['club-8', 'spade-10', 'heart-q', 'diamond-a', 'club-2'])('accepts %s', (id) => {
    expect(isCardId(id)).toBe(true);
  });

  it.each([
    'club-1',
    'club-11',
    'hearts-8',
    'club8',
    'club-',
    '-8',
    'CLUB-8',
    'club-8-x',
    '',
    'banana',
    null,
    42,
    undefined,
    ['club-8'],
  ])('rejects %p', (id) => {
    expect(isCardId(id)).toBe(false);
  });
});

describe('parseHostToFrame — sync', () => {
  it('accepts a well-formed sync envelope', () => {
    expect(parseHostToFrame(syncMessage())).toEqual(syncMessage());
  });

  it('accepts an empty room (pre-measurement / cleared board)', () => {
    const message = parseHostToFrame(syncMessage({ projection: projection({ room: [] }) }));
    expect(message?.kind === 'sync' && message.projection.room).toEqual([]);
  });

  it.each([
    ['wrong protocolVersion', syncMessage({ protocolVersion: 2 })],
    ['missing sessionId', syncMessage({ sessionId: undefined })],
    ['empty sessionId', syncMessage({ sessionId: '' })],
    ['oversized sessionId', syncMessage({ sessionId: 'x'.repeat(129) })],
    ['missing buildId', syncMessage({ buildId: undefined })],
    ['empty buildId', syncMessage({ buildId: '' })],
    ['oversized buildId', syncMessage({ buildId: 'x'.repeat(65) })],
    ['zero revision', syncMessage({ revision: 0 })],
    ['non-integer revision', syncMessage({ revision: 1.5 })],
    ['zero runGeneration', syncMessage({ runGeneration: 0 })],
    ['non-integer layoutRevision', syncMessage({ layoutRevision: 0.5 })],
    ['negative fxSeq', syncMessage({ fxSeq: -1 })],
    ['non-integer fxSeq', syncMessage({ fxSeq: 2.5 })],
    ['missing diagnostics flag', syncMessage({ diagnostics: undefined })],
    ['unknown kind', syncMessage({ kind: 'hover' })],
    ['missing projection', syncMessage({ projection: undefined })],
    ['projection not an object', syncMessage({ projection: 'room' })],
    [
      'non-finite x',
      syncMessage({
        projection: projection({
          room: [{ cardId: 'club-8', ...RECT, x: Number.POSITIVE_INFINITY }],
        }),
      }),
    ],
    [
      'zero width',
      syncMessage({ projection: projection({ room: [{ cardId: 'club-8', ...RECT, width: 0 }] }) }),
    ],
    [
      'negative height',
      syncMessage({
        projection: projection({ room: [{ cardId: 'club-8', ...RECT, height: -1 }] }),
      }),
    ],
    [
      'unknown card id in room',
      syncMessage({ projection: projection({ room: [{ cardId: 'club-11', ...RECT }] }) }),
    ],
    [
      'duplicate card ids',
      syncMessage({
        projection: projection({
          room: [
            { cardId: 'club-8', ...RECT },
            { cardId: 'club-8', ...RECT },
          ],
        }),
      }),
    ],
    [
      'selectedCardId not a card',
      syncMessage({ projection: projection({ selectedCardId: 'banana' }) }),
    ],
    ['carriedCardId wrong type', syncMessage({ projection: projection({ carriedCardId: 7 }) })],
    ['unknown phase', syncMessage({ projection: projection({ phase: 'paused' }) })],
    ['non-boolean reducedMotion', syncMessage({ projection: projection({ reducedMotion: 0 }) })],
    ['not an object', 'sync'],
    ['null', null],
  ] as const)('rejects %s', (_label, message) => {
    expect(parseHostToFrame(message)).toBeNull();
  });

  it('rejects rooms beyond the 4-card bound', () => {
    const room = ['club-2', 'club-3', 'club-4', 'club-5', 'club-6'].map((cardId, i) => ({
      cardId,
      ...RECT,
      x: i * 100,
    }));
    expect(parseHostToFrame(syncMessage({ projection: projection({ room }) }))).toBeNull();
  });
});

describe('parseHostToFrame — hover / policy / dispose', () => {
  it('accepts a well-formed hover envelope', () => {
    expect(parseHostToFrame({ kind: 'hover', ...HEAD, cardId: 'heart-9', over: true })).toEqual({
      kind: 'hover',
      ...HEAD,
      cardId: 'heart-9',
      over: true,
    });
  });

  it.each([
    ['unknown card id', { kind: 'hover', ...HEAD, cardId: 'club-99', over: true }],
    ['missing over', { kind: 'hover', ...HEAD, cardId: 'heart-9' }],
  ] as const)('rejects hover with %s', (_label, message) => {
    expect(parseHostToFrame(message)).toBeNull();
  });

  it('accepts a policy envelope', () => {
    expect(parseHostToFrame({ kind: 'policy', ...HEAD, reducedMotion: true })).toEqual({
      kind: 'policy',
      ...HEAD,
      reducedMotion: true,
    });
  });

  it('rejects a policy without a boolean', () => {
    expect(parseHostToFrame({ kind: 'policy', ...HEAD, reducedMotion: 'yes' })).toBeNull();
  });

  it('accepts a well-formed dispose envelope', () => {
    expect(parseHostToFrame({ kind: 'dispose', ...HEAD })).toEqual({ kind: 'dispose', ...HEAD });
  });

  it('rejects a dispose without a session', () => {
    expect(parseHostToFrame({ kind: 'dispose', protocolVersion: 1, buildId: 'spike' })).toBeNull();
  });
});

describe('parseFrameToHost — applied / settled / diagnostics', () => {
  it('accepts a well-formed applied envelope', () => {
    expect(
      parseFrameToHost({
        kind: 'applied',
        ...HEAD,
        revision: 3,
        runGeneration: 2,
        layoutRevision: 4,
      }),
    ).toEqual({ kind: 'applied', ...HEAD, revision: 3, runGeneration: 2, layoutRevision: 4 });
  });

  it('accepts a settled envelope', () => {
    expect(
      parseFrameToHost({
        kind: 'settled',
        ...HEAD,
        revision: 3,
        runGeneration: 2,
        layoutRevision: 4,
      }),
    ).toEqual({ kind: 'settled', ...HEAD, revision: 3, runGeneration: 2, layoutRevision: 4 });
  });

  it('accepts a diagnostics envelope with rendered rects', () => {
    expect(
      parseFrameToHost({
        kind: 'diagnostics',
        ...HEAD,
        revision: 3,
        runGeneration: 2,
        layoutRevision: 4,
        rects: [{ cardId: 'spade-8', x: 1.5, y: 2, width: 192, height: 268.8 }],
      }),
    ).toEqual({
      kind: 'diagnostics',
      ...HEAD,
      revision: 3,
      runGeneration: 2,
      layoutRevision: 4,
      rects: [{ cardId: 'spade-8', x: 1.5, y: 2, width: 192, height: 268.8 }],
    });
  });

  it.each([
    [
      'non-integer revision',
      { kind: 'applied', ...HEAD, revision: 0.5, runGeneration: 1, layoutRevision: 1 },
    ],
    [
      'zero runGeneration',
      { kind: 'applied', ...HEAD, revision: 1, runGeneration: 0, layoutRevision: 1 },
    ],
    [
      'wrong protocolVersion',
      {
        kind: 'applied',
        protocolVersion: 99,
        buildId: 'spike',
        sessionId: 's',
        revision: 1,
        runGeneration: 1,
        layoutRevision: 1,
      },
    ],
    ['unknown kind', { kind: 'ready', ...HEAD, revision: 1, runGeneration: 1, layoutRevision: 1 }],
    [
      'non-finite diagnostics rect',
      {
        kind: 'diagnostics',
        ...HEAD,
        revision: 1,
        runGeneration: 1,
        layoutRevision: 1,
        rects: [{ cardId: 'club-8', x: Number.NaN, y: 0, width: 1, height: 1 }],
      },
    ],
    [
      'oversized diagnostics rects',
      {
        kind: 'diagnostics',
        ...HEAD,
        revision: 1,
        runGeneration: 1,
        layoutRevision: 1,
        rects: Array.from({ length: 5 }, (_, i) => ({ cardId: `club-${i + 2}`, ...RECT })),
      },
    ],
  ] as const)('rejects %s', (_label, message) => {
    expect(parseFrameToHost(message)).toBeNull();
  });
});

describe('parseFrameToHost — bridge-ready / error', () => {
  it('accepts a bridge-ready envelope', () => {
    expect(parseFrameToHost({ kind: 'bridge-ready', ...HEAD })).toEqual({
      kind: 'bridge-ready',
      ...HEAD,
    });
  });

  it('accepts a boot error with an empty sessionId (pre-session failure)', () => {
    const message = parseFrameToHost({
      kind: 'error',
      protocolVersion: 1,
      buildId: 'spike',
      sessionId: '',
      code: 'boot',
      message: 'wasm fetch failed',
    });
    expect(message).not.toBeNull();
    expect(message?.kind === 'error' && message.code).toBe('boot');
  });

  it.each([
    [
      'unknown code',
      {
        kind: 'error',
        protocolVersion: 1,
        buildId: 'spike',
        sessionId: 's',
        code: 'panic',
        message: 'x',
      },
    ],
    [
      'missing message',
      { kind: 'error', protocolVersion: 1, buildId: 'spike', sessionId: 's', code: 'boot' },
    ],
    [
      'oversized message',
      {
        kind: 'error',
        protocolVersion: 1,
        buildId: 'spike',
        sessionId: 's',
        code: 'boot',
        message: 'x'.repeat(513),
      },
    ],
    [
      'missing buildId',
      { kind: 'error', protocolVersion: 1, sessionId: 's', code: 'boot', message: 'x' },
    ],
  ] as const)('rejects %s', (_label, message) => {
    expect(parseFrameToHost(message)).toBeNull();
  });
});
