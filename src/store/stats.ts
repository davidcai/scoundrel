import type { GameState } from '../engine';
import type { SerializedConfig } from './configCodec';
import { serializeConfig } from './configCodec';
import { loadVersioned, saveVersioned } from './persistence';

const STATS_KEY = 'scoundrel:stats';
const STATS_VERSION = 1;
const RUNS_CAP = 50;

export interface RunRecord {
  seed: string;
  config: SerializedConfig;
  outcome: 'won' | 'lost';
  score: number;
  date: number;
  roomsCleared: number;
}

export interface StatsData {
  gamesPlayed: number;
  wins: number;
  losses: number;
  bestScore: number;
  currentStreak: number;
  bestStreak: number;
  runs: RunRecord[];
}

export const EMPTY_STATS: StatsData = {
  gamesPlayed: 0,
  wins: 0,
  losses: 0,
  bestScore: 0,
  currentStreak: 0,
  bestStreak: 0,
  runs: [],
};

export function loadStats(): StatsData {
  return (
    loadVersioned<StatsData>(STATS_KEY, STATS_VERSION, (_v, d) => d as StatsData) ?? EMPTY_STATS
  );
}

export function saveStats(data: StatsData): void {
  saveVersioned(STATS_KEY, STATS_VERSION, data);
}

/** Fold a completed run into the aggregate stats (newest-first, capped). */
export function recordRun(stats: StatsData, record: RunRecord): StatsData {
  const streak = record.outcome === 'won' ? stats.currentStreak + 1 : 0;
  return {
    gamesPlayed: stats.gamesPlayed + 1,
    wins: stats.wins + (record.outcome === 'won' ? 1 : 0),
    losses: stats.losses + (record.outcome === 'lost' ? 1 : 0),
    bestScore: Math.max(stats.bestScore, record.score),
    currentStreak: streak,
    bestStreak: Math.max(stats.bestStreak, streak),
    runs: [record, ...stats.runs].slice(0, RUNS_CAP),
  };
}

export function buildRunRecord(state: GameState, outcome: 'won' | 'lost', score: number): RunRecord {
  return {
    seed: state.seed,
    config: serializeConfig(state.config),
    outcome,
    score,
    date: Date.now(),
    roomsCleared: state.runHighlights.roomsExplored,
  };
}
