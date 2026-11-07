import type { GameConfig, Highlights } from '../engine';
import type { FinishedRun } from './session';
export interface RunRecord {
  readonly id: number;
  readonly seed: string;
  readonly config: GameConfig;
  readonly outcome: 'won' | 'lost';
  readonly reason: 'cleared' | 'death' | 'abandoned';
  readonly score: number;
  readonly date: number;
  readonly highlights: Highlights;
}
export interface Statistics {
  readonly gamesPlayed: number;
  readonly wins: number;
  readonly losses: number;
  readonly bestScore: number | null;
  readonly currentStreak: number;
  readonly bestStreak: number;
}
export const EMPTY_STATISTICS: Statistics = {
  gamesPlayed: 0,
  wins: 0,
  losses: 0,
  bestScore: null,
  currentStreak: 0,
  bestStreak: 0,
};
export function recordOutcome(
  statistics: Statistics,
  history: readonly RunRecord[],
  game: FinishedRun,
  id: number,
  date: number,
) {
  const won = game.status === 'won';
  const currentStreak = won ? statistics.currentStreak + 1 : 0;
  const record: RunRecord = {
    id,
    seed: game.seed,
    config: game.config,
    outcome: game.status,
    reason: game.reason,
    score: game.score,
    date,
    highlights: game.board.highlights,
  };
  return {
    statistics: {
      gamesPlayed: statistics.gamesPlayed + 1,
      wins: statistics.wins + (won ? 1 : 0),
      losses: statistics.losses + (won ? 0 : 1),
      bestScore:
        statistics.bestScore === null ? game.score : Math.max(statistics.bestScore, game.score),
      currentStreak,
      bestStreak: Math.max(statistics.bestStreak, currentStreak),
    },
    history: [record, ...history].slice(0, 30),
  };
}
