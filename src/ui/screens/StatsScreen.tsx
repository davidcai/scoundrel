import { useState } from 'react';
import { useLanguage, useT } from '../../i18n';
import { loadStats } from '../../store/stats';
import { runUrl } from '../../store/share';
import { navigate } from '../router';

export function StatsScreen() {
  const t = useT();
  const lang = useLanguage((s) => s.lang);
  // Stats live in their own localStorage shard; read fresh on mount.
  const [stats] = useState(() => loadStats());
  const winRate = stats.gamesPlayed > 0 ? Math.round((stats.wins / stats.gamesPlayed) * 100) : 0;

  return (
    <main className="screen">
      <div className="panel">
        <header className="panel-header">
          <h2>{t('stats')}</h2>
          <button type="button" className="btn ghost" onClick={() => navigate('#/')}>
            {t('backToTitle')}
          </button>
        </header>

        <div className="stat-grid">
          <Stat label={t('gamesPlayed')} value={stats.gamesPlayed} />
          <Stat label={t('wins')} value={stats.wins} />
          <Stat label={t('losses')} value={stats.losses} />
          <Stat label={t('winRate')} value={`${winRate}%`} />
          <Stat label={t('bestScore')} value={stats.bestScore} />
          <Stat label={t('currentStreak')} value={stats.currentStreak} />
          <Stat label={t('bestStreak')} value={stats.bestStreak} />
        </div>

        <h3 className="zone-title">{t('runHistory')}</h3>
        {stats.runs.length === 0 ? (
          <p className="muted">{t('noRuns')}</p>
        ) : (
          <div className="run-history" role="table" aria-label={t('runHistoryAria')}>
            {stats.runs.map((run) => (
              <div key={`${run.seed}-${run.date}`} className="run-row" role="row">
                <span className="mono" role="cell">
                  {run.seed}
                </span>
                <span role="cell" data-outcome={run.outcome}>
                  {run.outcome === 'won' ? t('win') : t('loss')}
                </span>
                <span role="cell">{t('scoreOf', { score: run.score })}</span>
                <span role="cell">{t('roomsCount', { rooms: run.roomsCleared })}</span>
                <span role="cell">
                  {new Date(run.date).toLocaleDateString(lang === 'zh' ? 'zh-CN' : undefined)}
                </span>
                <button
                  type="button"
                  className="btn small"
                  onClick={() => navigate(runUrl(run.seed, run.config))}
                >
                  {t('replay')}
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
