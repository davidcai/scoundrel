import { describe, expect, it } from 'vitest';
import type { BoardProjection } from '../src/game/board-protocol';
import {
  PROTOCOL_VERSION,
  isCardId,
  parseFrameToHost,
  parseHostToFrame,
} from '../src/game/board-protocol';

/**
 * Protocol tests (godot-plan.md §Test plan 2, Phase 1 subset): structural
 * validation on both ends of the frame boundary — malformed shapes, unknown
 * identities, non-finite geometry, bounds. Sequencing behavior (revision
 * promotion, latest-wins) lives in the transport/GodotBoard tests; these pin
 * the wire format itself.
 */

const RECT = { x: 10, y: 20, width: 192, height: 268.8 };

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
    protocolVersion: PROTOCOL_VERSION,
    sessionId: 'sess-abc',
    revision: 1,
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
    const message = parseHostToFrame(syncMessage());
    expect(message).toEqual(syncMessage());
  });

  it('accepts an empty room (pre-measurement / cleared board)', () => {
    const message = parseHostToFrame(syncMessage({ projection: projection({ room: [] }) }));
    expect(message).not.toBeNull();
    expect(message?.kind === 'sync' && message.projection.room).toEqual([]);
  });

  it.each([
    ['wrong protocolVersion', syncMessage({ protocolVersion: 2 })],
    ['missing sessionId', syncMessage({ sessionId: undefined })],
    ['empty sessionId', syncMessage({ sessionId: '' })],
    ['oversized sessionId', syncMessage({ sessionId: 'x'.repeat(129) })],
    ['zero revision', syncMessage({ revision: 0 })],
    ['non-integer revision', syncMessage({ revision: 1.5 })],
    ['non-finite revision', syncMessage({ revision: Number.NaN })],
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

describe('parseHostToFrame — dispose', () => {
  it('accepts a well-formed dispose envelope', () => {
    expect(
      parseHostToFrame({ kind: 'dispose', protocolVersion: 1, sessionId: 'sess-abc' }),
    ).toEqual({
      kind: 'dispose',
      protocolVersion: 1,
      sessionId: 'sess-abc',
    });
  });

  it('rejects a dispose without a session', () => {
    expect(parseHostToFrame({ kind: 'dispose', protocolVersion: 1 })).toBeNull();
  });
});

describe('parseFrameToHost — applied', () => {
  it('accepts a well-formed applied envelope', () => {
    expect(
      parseFrameToHost({ kind: 'applied', protocolVersion: 1, sessionId: 'sess-abc', revision: 3 }),
    ).toEqual({
      kind: 'applied',
      protocolVersion: 1,
      sessionId: 'sess-abc',
      revision: 3,
    });
  });

  it.each([
    [
      'non-integer revision',
      { kind: 'applied', protocolVersion: 1, sessionId: 's', revision: 0.5 },
    ],
    [
      'wrong protocolVersion',
      { kind: 'applied', protocolVersion: 99, sessionId: 's', revision: 1 },
    ],
    ['unknown kind', { kind: 'ready', protocolVersion: 1, sessionId: 's', revision: 1 }],
  ] as const)('rejects %s', (_label, message) => {
    expect(parseFrameToHost(message)).toBeNull();
  });
});

describe('parseFrameToHost — error', () => {
  it('accepts a boot error with an empty sessionId (pre-session failure)', () => {
    const message = parseFrameToHost({
      kind: 'error',
      protocolVersion: 1,
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
      { kind: 'error', protocolVersion: 1, sessionId: 's', code: 'panic', message: 'x' },
    ],
    ['missing message', { kind: 'error', protocolVersion: 1, sessionId: 's', code: 'boot' }],
    [
      'oversized message',
      { kind: 'error', protocolVersion: 1, sessionId: 's', code: 'boot', message: 'x'.repeat(513) },
    ],
    [
      'wrong protocolVersion',
      { kind: 'error', protocolVersion: 0, sessionId: 's', code: 'boot', message: 'x' },
    ],
  ] as const)('rejects %s', (_label, message) => {
    expect(parseFrameToHost(message)).toBeNull();
  });
});
