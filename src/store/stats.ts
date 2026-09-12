import type { GameConfig } from '../engine';
import { STORAGE_KEYS, load, migrateVersion, save } from './persistence';

export interface RunRecord {
  seed: string;
  config: GameConfig;
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
  /** Newest first, capped at MAX_RUNS. */
  runs: RunRecord[];
}

export const MAX_RUNS = 50;

export function emptyStats(): StatsData {
  return {
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    bestScore: 0,
    currentStreak: 0,
    bestStreak: 0,
    runs: [],
  };
}

function isRunRecord(value: unknown): value is RunRecord {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.seed === 'string' &&
    typeof v.config === 'object' &&
    v.config !== null &&
    (v.outcome === 'won' || v.outcome === 'lost') &&
    typeof v.score === 'number' &&
    typeof v.date === 'number' &&
    typeof v.roomsCleared === 'number'
  );
}

function read(raw: unknown): StatsData | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const v = raw as Record<string, unknown>;
  const numeric = [
    v.gamesPlayed,
    v.wins,
    v.losses,
    v.bestScore,
    v.currentStreak,
    v.bestStreak,
  ].every((n) => typeof n === 'number');
  if (!numeric || !Array.isArray(v.runs) || !v.runs.every(isRunRecord)) return null;
  return raw as StatsData;
}

export function loadStats(): StatsData {
  return load<StatsData>(STORAGE_KEYS.stats, migrateVersion(1, read)) ?? emptyStats();
}

export function saveStats(stats: StatsData): void {
  save<StatsData>(STORAGE_KEYS.stats, stats);
}

/** Pure aggregate update: folds a finished run into the stats. */
export function recordRun(stats: StatsData, record: RunRecord): StatsData {
  const won = record.outcome === 'won';
  const currentStreak = won ? stats.currentStreak + 1 : 0;
  return {
    gamesPlayed: stats.gamesPlayed + 1,
    wins: stats.wins + (won ? 1 : 0),
    losses: stats.losses + (won ? 0 : 1),
    bestScore: Math.max(stats.bestScore, record.score),
    currentStreak,
    bestStreak: Math.max(stats.bestStreak, currentStreak),
    runs: [record, ...stats.runs].slice(0, MAX_RUNS),
  };
}
