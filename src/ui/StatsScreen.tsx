import type { Session } from '../store/session';
import type { RunRecord } from '../store/statistics';
import type { Translate } from '../i18n/translate';
export function StatsScreen({
  session,
  locale,
  t,
  onReplay,
  onTitle,
}: {
  session: Session;
  locale: 'en' | 'zh';
  t: Translate;
  onReplay: (record: RunRecord) => void;
  onTitle: () => void;
}) {
  const s = session.statistics;
  const metrics = [
    ['gamesPlayed', s.gamesPlayed],
    ['wins', s.wins],
    ['losses', s.losses],
    [
      'winRate',
      new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(
        s.gamesPlayed ? s.wins / s.gamesPlayed : 0,
      ),
    ],
    ['bestScore', s.bestScore ?? t('noScore')],
    ['currentStreak', s.currentStreak],
    ['bestStreak', s.bestStreak],
  ] as const;
  return (
    <section className="statistics-screen">
      <div className="screen-heading">
        <h1>{t('stats')}</h1>
        <button onClick={onTitle}>{t('backTitle')}</button>
      </div>
      <dl className="stat-grid">
        {metrics.map(([key, value]) => (
          <div key={key}>
            <dt>{t(key)}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="history-heading">
        <h2>{t('runHistory')}</h2>
        <p className="muted">{t('historyLimit')}</p>
      </div>
      {session.history.length === 0 ? (
        <p className="empty-history">{t('emptyHistory')}</p>
      ) : (
        <ol className="history-list">
          {session.history.map((record) => (
            <li key={record.id}>
              <article className="history-entry">
                <div className="history-header">
                  <h3>{record.seed}</h3>
                  <span className={`outcome-badge ${record.outcome}`}>
                    {t(
                      record.reason === 'abandoned'
                        ? 'abandoned'
                        : record.outcome === 'won'
                          ? 'win'
                          : 'loss',
                    )}
                  </span>
                  <time dateTime={new Date(record.date).toISOString()}>
                    {new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(record.date)}
                  </time>
                </div>
                <dl className="history-details">
                  <div>
                    <dt>{t('score')}</dt>
                    <dd>{record.score}</dd>
                  </div>
                  <div>
                    <dt>{t('roomsCleared')}</dt>
                    <dd>{record.highlights.roomsCleared}</dd>
                  </div>
                  <div>
                    <dt>{t('roomsExplored')}</dt>
                    <dd>{record.highlights.roomsExplored}</dd>
                  </div>
                </dl>
                <details>
                  <summary>{t('runRules')}</summary>
                  <dl className="history-details">
                    {(
                      ['allowConsecutiveEscapes', 'unlimitedPotions', 'weaponDegradation'] as const
                    ).map((key) => (
                      <div key={key}>
                        <dt>{t(key)}</dt>
                        <dd>{t(record.config[key] ? 'on' : 'off')}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
                <button onClick={() => onReplay(record)}>{t('replayRun')}</button>
              </article>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
