import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../engine';
import { WINNING_ACTIONS, WINNING_SEED } from '../../tests/fixtures/winning-run';
import { bootstrap } from './bootstrap';
import {
  decodeSave,
  emptySave,
  encodeSave,
  migrateEnvelope,
  saveDataSchema,
  UnsupportedSave,
} from './persistence';
import { EMPTY_SESSION, sessionReducer } from './session';
import type { FinishedRun, Session } from './session';
import { EMPTY_STATISTICS, recordOutcome } from './statistics';
function started(seed = 'cinder') {
  return sessionReducer(EMPTY_SESSION, { type: 'start', seed, config: DEFAULT_CONFIG, at: 1000 });
}
function win() {
  let s = started(WINNING_SEED);
  for (const action of WINNING_ACTIONS) s = sessionReducer(s, { type: 'act', action, at: 2000 });
  expect(s.game?.status).toBe('won');
  return s;
}
function data(session = started()) {
  return { ...emptySave(), session };
}
describe('durable game and room undo', () => {
  it('restores progress and exact room undo without persisting selection or announcements', () => {
    const initial = started();
    let s = sessionReducer(initial, { type: 'select', cardId: 'diamond-6' });
    s = sessionReducer(s, { type: 'act', action: { type: 'equip', cardId: 'diamond-6' } });
    s = sessionReducer(s, { type: 'select', cardId: 'spade-7' });
    const saved = decodeSave(encodeSave(data(s)));
    expect(saved.session.selected).toBe(null);
    expect(saved.session.result).toBe(null);
    expect(saved.session.game).toEqual(s.game);
    expect(sessionReducer(saved.session, { type: 'act', action: { type: 'undo' } }).game).toEqual(
      initial.game,
    );
  });
  it('preserves settings independently from active-run rules', () => {
    const save = data();
    save.preferences = {
      language: 'zh',
      reducedMotion: true,
      config: { allowConsecutiveEscapes: true, unlimitedPotions: true, weaponDegradation: false },
    };
    const restored = decodeSave(encodeSave(save));
    expect(restored.preferences).toEqual(save.preferences);
    expect(restored.session.game?.config).toEqual(DEFAULT_CONFIG);
  });
  it('reload restores unfinished runs at title but preserves completed result screens without recounting', async () => {
    const active = data();
    const finished = data(win());
    const restored = bootstrap(
      decodeSave(encodeSave(active)),
      '#/play?v=1&seed=cinder&rules=001',
      1,
      3000,
    );
    expect(restored.data.session.screen).toBe('title');
    expect(restored.data.session.statistics.gamesPlayed).toBe(0);
    const score = bootstrap(
      decodeSave(encodeSave(finished)),
      `#/play?v=1&seed=${WINNING_SEED}&rules=001`,
      1,
      3000,
    );
    expect(score.data.session.screen).toBe('play');
    expect(score.data.session.statistics.gamesPlayed).toBe(1);
    expect(
      sessionReducer(score.data.session, { type: 'act', action: { type: 'undo' } }).statistics
        .gamesPlayed,
    ).toBe(1);
  });
  it('a fresh external replay is a new attempt even when its seed matches the saved run', () => {
    const loaded = bootstrap(data(), '#/play?v=1&seed=cinder&rules=001', null, 3000);
    expect(loaded.data.session.runNumber).toBe(2);
    expect(loaded.data.session.statistics.losses).toBe(1);
    expect(loaded.data.session.history[0].reason).toBe('abandoned');
  });
  it('invalid replay does not replace or lose the active run', () => {
    const save = data();
    const result = bootstrap(save, '#/play?v=2&seed=cinder&rules=001', null, 3000);
    expect(result.linkError).toBe(true);
    expect(result.changed).toBe(false);
    expect(result.data.session.game).toEqual(save.session.game);
    expect(result.data.session.statistics.gamesPlayed).toBe(0);
  });
  it('explicitly discards an active run once while preserving preferences and previous statistics', () => {
    const s = sessionReducer(started(), { type: 'discard', at: 2000 });
    expect(s.game).toBe(null);
    expect(s.statistics.losses).toBe(1);
    expect(s.history[0].reason).toBe('abandoned');
    expect(sessionReducer(s, { type: 'discard' }).statistics.losses).toBe(1);
    expect(decodeSave(encodeSave(data(s))).session.game).toBe(null);
  });
});

describe('lifetime aggregates and recent history', () => {
  it('counts win win loss win, including abandonment, once and updates best score correctly', () => {
    const won = win().game!;
    const lost = sessionReducer(started(), { type: 'act', action: { type: 'abandon' } }).game!;
    if (won.status === 'playing' || lost.status === 'playing')
      throw new Error('Fixture must finish');
    let stats = EMPTY_STATISTICS;
    let history: ReturnType<typeof recordOutcome>['history'] = [];
    [won, won, lost, won].forEach((game, i) => {
      const next = recordOutcome(stats, history, game, i + 1, 1000 + i);
      stats = next.statistics;
      history = next.history;
    });
    expect(stats).toEqual({
      gamesPlayed: 4,
      wins: 3,
      losses: 1,
      bestScore: 7,
      currentStreak: 1,
      bestStreak: 2,
    });
    expect(history.map((r) => r.id)).toEqual([4, 3, 2, 1]);
  });
  it('retains newest 30 outcomes while totals, best score and streaks survive trimming', () => {
    const won = win().game as FinishedRun;
    let stats = EMPTY_STATISTICS;
    let history: ReturnType<typeof recordOutcome>['history'] = [];
    for (let i = 1; i <= 51; i++) {
      const n = recordOutcome(stats, history, won, i, 1000 + i);
      stats = n.statistics;
      history = n.history;
    }
    expect(history).toHaveLength(30);
    expect(history[0].id).toBe(51);
    expect(history.at(-1)?.id).toBe(22);
    expect(stats).toEqual({
      gamesPlayed: 51,
      wins: 51,
      losses: 0,
      bestScore: 7,
      currentStreak: 51,
      bestStreak: 51,
    });
    const session: Session = {
      ...EMPTY_SESSION,
      game: won,
      screen: 'play',
      runNumber: 51,
      statistics: stats,
      history,
    };
    expect(decodeSave(encodeSave(data(session))).session.statistics).toEqual(stats);
  });
  it('does not initialize best score at zero when all losses are negative', () => {
    const lost = sessionReducer(started(), { type: 'act', action: { type: 'abandon' } }).game!;
    if (lost.status === 'playing') throw new Error('Fixture must finish');
    const n = recordOutcome(EMPTY_STATISTICS, [], lost, 1, 1000);
    expect(n.statistics.bestScore).toBe(lost.score);
    expect(lost.score).toBeLessThan(0);
  });
});

describe('save envelope and validation', () => {
  it('keeps a terminal result and its counted outcome together in one envelope', () => {
    const loaded = decodeSave(encodeSave(data(win())));
    expect(loaded.session.game?.status).toBe('won');
    expect(loaded.session.statistics.wins).toBe(1);
    expect(loaded.session.history).toHaveLength(1);
  });
  it.each([
    '',
    '{',
    'null',
    JSON.stringify({ version: 1, data: {} }),
    JSON.stringify({ version: 999, data: {} }),
  ])('rejects unreadable or unsupported saves %s', (raw) =>
    expect(() => decodeSave(raw)).toThrow(),
  );
  it('rejects duplicate cards, unsafe timestamps, invalid phase states and inconsistent counts', () => {
    const corrupt = JSON.parse(encodeSave(data()));
    corrupt.data.session.game.board.room[0] = corrupt.data.session.game.board.room[1];
    expect(() => decodeSave(JSON.stringify(corrupt))).toThrow();
    const counts = JSON.parse(encodeSave(data()));
    counts.data.session.statistics.losses = 5;
    expect(() => decodeSave(JSON.stringify(counts))).toThrow();
    const phase = JSON.parse(encodeSave(data()));
    phase.data.session.game.board.health = 0;
    expect(() => decodeSave(JSON.stringify(phase))).toThrow();
    const dates = JSON.parse(encodeSave(data(win())));
    dates.data.session.history[0].date = Number.MAX_SAFE_INTEGER;
    expect(() => decodeSave(JSON.stringify(dates))).toThrow();
  });
  it('has a migration chain that preserves this game’s progress and preferences across a supported format change', () => {
    const s = sessionReducer(started(), {
      type: 'act',
      action: { type: 'equip', cardId: 'diamond-6' },
    });
    const raw = encodeSave(data(s));
    const updated = migrateEnvelope(raw, 2, {
      1: (old) => ({ ...saveDataSchema.parse(old), newOptionalField: true }),
    });
    const restored = saveDataSchema.parse(updated);
    expect(restored.session.game).toEqual(s.game);
    expect(restored.preferences).toEqual(data(s).preferences);
    expect(
      sessionReducer(restored.session, { type: 'act', action: { type: 'undo' } }).game,
    ).toEqual(started().game);
    expect(() => migrateEnvelope(raw, 2)).toThrow(UnsupportedSave);
  });
});
