import { describe, expect, it } from 'vitest';
import {
  CANONICAL_DECK,
  DEFAULT_RULE_CONFIG,
  cardKind,
  createInitialState,
  type CardId,
  type GameState,
} from '../engine';
import { createSession, sessionReducer, type UiSession } from './gameSession';

function reduce(session: UiSession, action: Parameters<typeof sessionReducer>[1]): UiSession {
  const next = sessionReducer(session, action);
  if (next === null) throw new Error('Session unexpectedly cleared');
  return next;
}

function findSeedWith(
  predicate: (state: GameState) => boolean,
  prefix: string,
  maxSeeds = 200,
): string {
  for (let index = 0; index < maxSeeds; index += 1) {
    const seed = `${prefix}-${index}`;
    if (predicate(createInitialState(seed, DEFAULT_RULE_CONFIG))) return seed;
  }
  throw new Error(`No seed matched ${prefix}`);
}

function sessionWith(kind: 'monster' | 'weapon' | 'potion'): { session: UiSession; card: CardId } {
  const seed = findSeedWith(
    (state) => state.room.cards.some((roomCard) => cardKind(roomCard.card) === kind),
    `session-${kind}`,
  );
  const session = createSession(seed, DEFAULT_RULE_CONFIG);
  const card = session.state.room.cards.find((roomCard) => cardKind(roomCard.card) === kind)!.card;
  return { session, card };
}

describe('game session store', () => {
  it('starts from the engine state with no interface selection', () => {
    const session = createSession('session-seed', DEFAULT_RULE_CONFIG);

    expect(session.state.status).toBe('playing');
    expect(session.selectedCard).toBeNull();
    expect(session.preview).toBeNull();
    expect(session.previewRejection).toBeNull();
    expect(session.notice).toBeNull();
    expect(session.noticeSeq).toBe(0);
  });

  it('previews a monster without touching engine truth', () => {
    const { session, card } = sessionWith('monster');
    const before = session.state;

    const next = reduce(session, { type: 'select', card });

    expect(next.preview?.kind).toBe('monster');
    expect(next.selectedCard).toBe(card);
    expect(next.previewRejection).toBeNull();
    expect(next.state).toBe(before);
  });

  it('previews the exact event a weapon card would produce', () => {
    const { session, card } = sessionWith('weapon');

    const next = reduce(session, { type: 'select', card });

    expect(next.preview?.kind).toBe('action');
    if (next.preview?.kind === 'action') {
      expect(next.preview.event.type).toBe('cardResolved');
      if (next.preview.event.type === 'cardResolved') {
        expect(next.preview.event.card).toBe(card);
      }
    }
  });

  it('reports a selection that is not in the room', () => {
    const session = createSession('session-seed', DEFAULT_RULE_CONFIG);
    const roomCards = new Set(session.state.room.cards.map((roomCard) => roomCard.card));
    const outside = CANONICAL_DECK.find((deckCard) => !roomCards.has(deckCard))!;

    const next = reduce(session, { type: 'select', card: outside });

    expect(next.preview).toBeNull();
    expect(next.previewRejection).toBe('card-not-in-room');
  });

  it('ignores a resolve with no selection', () => {
    const session = createSession('session-seed', DEFAULT_RULE_CONFIG);

    expect(sessionReducer(session, { type: 'resolve' })).toBe(session);
  });

  it('applies a confirmed resolve and clears the selection', () => {
    const { session, card } = sessionWith('monster');
    const selected = sessionReducer(session, { type: 'select', card })!;

    const next = reduce(selected, { type: 'resolve', attack: 'barehanded' });

    expect(next.state.room.cards).toHaveLength(3);
    expect(next.state.health).toBeLessThanOrEqual(20);
    expect(next.selectedCard).toBeNull();
    expect(next.preview).toBeNull();
    expect(next.notice?.kind).toBe('event');
    expect(next.noticeSeq).toBe(1);
  });

  it('applies run away and records the event notice', () => {
    const session = createSession('session-seed', DEFAULT_RULE_CONFIG);

    const next = reduce(session, { type: 'runAway' });

    expect(next.state.highlights.roomsExplored).toBe(2);
    expect(next.state.room.cards).toHaveLength(4);
    expect(next.notice?.kind).toBe('event');
    if (next.notice?.kind === 'event' && next.notice.event.type === 'runAway') {
      expect(next.notice.event.type).toBe('runAway');
    }
  });

  it('clears the selection', () => {
    const { session, card } = sessionWith('monster');
    const selected = sessionReducer(session, { type: 'select', card })!;

    const next = reduce(selected, { type: 'clearSelection' });

    expect(next.selectedCard).toBeNull();
    expect(next.preview).toBeNull();
    expect(next.previewRejection).toBeNull();
  });

  it('replaces and clears sessions', () => {
    const first = createSession('session-one', DEFAULT_RULE_CONFIG);
    const second = createSession('session-two', DEFAULT_RULE_CONFIG);

    expect(sessionReducer(first, { type: 'replace', session: second })).toBe(second);
    expect(sessionReducer(first, { type: 'clear' })).toBeNull();
  });
});
