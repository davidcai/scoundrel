import { useState } from 'react';
import { loadStats } from '../../store/stats';
import { runUrl } from '../../store/share';
import { navigate } from '../router';

export function StatsScreen() {
  // Stats live in their own localStorage shard; read fresh on mount.
  const [stats] = useState(() => loadStats());
  const winRate = stats.gamesPlayed > 0 ? Math.round((stats.wins / stats.gamesPlayed) * 100) : 0;

  return (
    <main className="screen">
      <div className="panel">
        <header className="panel-header">
          <h2>Stats</h2>
          <button type="button" className="btn ghost" onClick={() => navigate('#/')}>
            ← Title
          </button>
        </header>

        <div className="stat-grid">
          <Stat label="Games played" value={stats.gamesPlayed} />
          <Stat label="Wins" value={stats.wins} />
          <Stat label="Losses" value={stats.losses} />
          <Stat label="Win rate" value={`${winRate}%`} />
          <Stat label="Best score" value={stats.bestScore} />
          <Stat label="Current streak" value={stats.currentStreak} />
          <Stat label="Best streak" value={stats.bestStreak} />
        </div>

        <h3 className="zone-title">Run history</h3>
        {stats.runs.length === 0 ? (
          <p className="muted">No runs yet — go clear a dungeon.</p>
        ) : (
          <div className="run-history" role="table" aria-label="Run history, newest first">
            {stats.runs.map((run) => (
              <div key={`${run.seed}-${run.date}`} className="run-row" role="row">
                <span className="mono" role="cell">
                  {run.seed}
                </span>
                <span role="cell" data-outcome={run.outcome}>
                  {run.outcome === 'won' ? 'Win' : 'Loss'}
                </span>
                <span role="cell">Score {run.score}</span>
                <span role="cell">{run.roomsCleared} rooms</span>
                <span role="cell">{new Date(run.date).toLocaleDateString()}</span>
                <button
                  type="button"
                  className="btn small"
                  onClick={() => navigate(runUrl(run.seed, run.config))}
                >
                  Replay
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="stat-card">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}
