/**
 * Stats dashboard (#/stats): aggregates (games played, wins/losses, win-rate,
 * best score, current + best streak) and the scrollable run history — newest
 * first, capped at 50 (Q48–Q50). Each entry's Replay loads its seed + config.
 */
import { useMemo } from 'react';
import { loadStats, type RunRecord } from '../../persistence/stats';
import { replayHash } from '../router/configCodec';
import { navigate } from '../router/useHashRoute';
import './StatsScreen.css';

function outcomeText(outcome: RunRecord['outcome']): string {
  return outcome === 'won' ? 'Won' : 'Lost';
}

function recordToggles(rec: RunRecord): string {
  const parts: string[] = [];
  if (rec.config.runAwayMode !== 'once') parts.push('unlimited runs');
  if (rec.config.potionsPerRoom !== 1) parts.push('unlimited potions');
  if (!rec.config.weaponDegradation) parts.push('no degradation');
  return parts.length > 0 ? parts.join(', ') : 'canonical rules';
}

export function StatsScreen() {
  const stats = useMemo(() => loadStats(), []);
  const winRate = stats.gamesPlayed > 0 ? Math.round((stats.wins / stats.gamesPlayed) * 100) : null;

  return (
    <main className="stats-screen">
      <h1 className="stats-title">Stats</h1>

      <dl className="stats-grid">
        <div className="stats-cell">
          <dt>Games played</dt>
          <dd className="tabular">{stats.gamesPlayed}</dd>
        </div>
        <div className="stats-cell">
          <dt>Wins</dt>
          <dd className="tabular">{stats.wins}</dd>
        </div>
        <div className="stats-cell">
          <dt>Losses</dt>
          <dd className="tabular">{stats.losses}</dd>
        </div>
        <div className="stats-cell">
          <dt>Win rate</dt>
          <dd className="tabular">{winRate === null ? '—' : `${winRate}%`}</dd>
        </div>
        <div className="stats-cell">
          <dt>Best score</dt>
          <dd className="tabular">{stats.bestScore === null ? '—' : stats.bestScore}</dd>
        </div>
        <div className="stats-cell">
          <dt>Current streak</dt>
          <dd className="tabular">{stats.currentStreak}</dd>
        </div>
        <div className="stats-cell">
          <dt>Best streak</dt>
          <dd className="tabular">{stats.bestStreak}</dd>
        </div>
      </dl>

      <h2 className="stats-history-title">Run history</h2>
      {stats.runs.length === 0 ? (
        <p className="stats-empty">No runs yet — the dungeon awaits.</p>
      ) : (
        <ol className="stats-history">
          {stats.runs.map((rec) => (
            <li key={`${rec.seed}-${rec.date}`} className="stats-run">
              <div className="stats-run-main">
                <span
                  className={
                    rec.outcome === 'won'
                      ? 'stats-run-outcome stats-run-outcome--won'
                      : 'stats-run-outcome stats-run-outcome--lost'
                  }
                >
                  {outcomeText(rec.outcome)}
                </span>
                <span className="tabular stats-run-score">{rec.score}</span>
                <span className="stats-run-seed">{rec.seed}</span>
                <span className="stats-run-config">{recordToggles(rec)}</span>
              </div>
              <div className="stats-run-meta">
                <span>{new Date(rec.date).toLocaleDateString()}</span>
                <span aria-hidden="true">·</span>
                <span>{rec.roomsCleared} rooms</span>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  className="stats-run-replay"
                  onClick={() => navigate(replayHash(rec.seed, rec.config))}
                >
                  Replay
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <button type="button" className="btn btn--ghost" onClick={() => navigate('#/')}>
        Back to title
      </button>
    </main>
  );
}
