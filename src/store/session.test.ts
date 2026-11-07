import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../engine';
import { EMPTY_SESSION, sessionReducer } from './session';

describe('session integration', () => {
  it('keeps selection separate from engine truth and records replacement losses once', () => {
    const initial = sessionReducer(EMPTY_SESSION, {
      type: 'start',
      seed: 'cinder',
      config: DEFAULT_CONFIG,
    });
    const selected = sessionReducer(initial, { type: 'select', cardId: 'diamond-6' });
    expect(selected.game).toBe(initial.game);
    const equipped = sessionReducer(selected, {
      type: 'act',
      action: { type: 'equip', cardId: 'diamond-6' },
    });
    expect(equipped.selected).toBe(null);
    const replacement = sessionReducer(equipped, {
      type: 'start',
      seed: 'other',
      config: DEFAULT_CONFIG,
    });
    expect(replacement.history).toHaveLength(1);
    expect(replacement.history[0].reason).toBe('abandoned');
    const menu = sessionReducer(replacement, { type: 'title' });
    expect(menu.game).toBe(replacement.game);
    expect(sessionReducer(menu, { type: 'continue' }).history).toHaveLength(1);
  });
  it('rejects invalid replacement before losing an active run', () => {
    const s = sessionReducer(EMPTY_SESSION, {
      type: 'start',
      seed: 'cinder',
      config: DEFAULT_CONFIG,
    });
    expect(() => sessionReducer(s, { type: 'start', seed: '!', config: DEFAULT_CONFIG })).toThrow();
    expect(s.game?.status).toBe('playing');
    expect(s.history).toEqual([]);
  });
  it('records a terminal result once even after repeated confirmation and starting another run', () => {
    let s = sessionReducer(EMPTY_SESSION, {
      type: 'start',
      seed: 'cinder',
      config: DEFAULT_CONFIG,
    });
    s = sessionReducer(s, { type: 'act', action: { type: 'abandon' } });
    s = sessionReducer(s, { type: 'act', action: { type: 'abandon' } });
    s = sessionReducer(s, { type: 'act', action: { type: 'undo' } });
    expect(s.history).toHaveLength(1);
    expect(
      sessionReducer(s, { type: 'start', seed: 'next', config: DEFAULT_CONFIG }).history,
    ).toHaveLength(1);
  });
});
