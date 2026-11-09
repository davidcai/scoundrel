/**
 * Lifetime statistics and run history (REQ-013).
 *
 * Everything rendered here comes from the committed store snapshot: lifetime
 * counters, the newest-first history (already trimmed to 50), and one replay
 * action per readable history entry.
 */
import { useEffect, useId, useRef } from 'react';
import { formatNumber } from '../../i18n';
import {
  formatHistoryDate,
  formatRulesDescription,
  formatWinRate,
  historyOutcomeText,
} from '../../i18n/messages';
import { usePreferences } from '../../store/preferences';
import { useScoundrelSnapshot } from '../../store/useScoundrelStore';
import { Button } from '../components/Button';

export interface StatsScreenProps {
  onBackToTitle: () => void;
  onReplay: (runId: string) => void;
}

export function StatsScreen({ onBackToTitle, onReplay }: StatsScreenProps) {
  const { t, locale } = usePreferences();
  const snapshot = useScoundrelSnapshot();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const summaryTitleId = useId();
  const historyTitleId = useId();

  const { statistics, winRatePercent, history } = snapshot;

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="screen-screen">
      <main className="screen-panel" aria-labelledby="stats-heading">
        <Button
          variant="ghost"
          className="screen-panel__close"
          aria-label={t('stats.close')}
          onClick={onBackToTitle}
        >
          <span aria-hidden="true">×</span>
        </Button>
        <h1 className="screen-panel__title" id="stats-heading" tabIndex={-1} ref={headingRef}>
          {t('stats.title')}
        </h1>

        <section className="stats-summary" aria-labelledby={summaryTitleId}>
          <h2 className="screen-panel__section-title" id={summaryTitleId}>
            {t('stats.summaryTitle')}
          </h2>
          <dl className="stat-grid">
            <div className="stat-grid__row">
              <dt>{t('stats.gamesPlayed')}</dt>
              <dd>{formatNumber(locale, statistics.gamesPlayed)}</dd>
            </div>
            <div className="stat-grid__row">
              <dt>{t('stats.wins')}</dt>
              <dd>{formatNumber(locale, statistics.wins)}</dd>
            </div>
            <div className="stat-grid__row">
              <dt>{t('stats.losses')}</dt>
              <dd>{formatNumber(locale, statistics.losses)}</dd>
            </div>
            <div className="stat-grid__row">
              <dt>{t('stats.winRate')}</dt>
              <dd>{formatWinRate(t, winRatePercent)}</dd>
            </div>
            <div className="stat-grid__row">
              <dt>{t('stats.bestScore')}</dt>
              <dd>
                {statistics.bestScore === null
                  ? t('stats.none')
                  : formatNumber(locale, statistics.bestScore)}
              </dd>
            </div>
            <div className="stat-grid__row">
              <dt>{t('stats.currentStreak')}</dt>
              <dd>{formatNumber(locale, statistics.currentStreak)}</dd>
            </div>
            <div className="stat-grid__row">
              <dt>{t('stats.bestStreak')}</dt>
              <dd>{formatNumber(locale, statistics.bestStreak)}</dd>
            </div>
          </dl>
        </section>

        <section className="history" aria-labelledby={historyTitleId}>
          <h2 className="screen-panel__section-title" id={historyTitleId}>
            {t('stats.historyTitle')}
          </h2>
          {history.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state__title">{t('stats.emptyTitle')}</p>
              <p className="empty-state__body">{t('stats.emptyBody')}</p>
            </div>
          ) : (
            <>
              <div
                className="table-scroll"
                role="region"
                aria-label={t('stats.historyTitle')}
                tabIndex={0}
              >
                <table className="data-table history-table">
                  <caption className="visually-hidden">{t('stats.historyCaption')}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{t('stats.columnDate')}</th>
                      <th scope="col">{t('stats.columnSeed')}</th>
                      <th scope="col">{t('stats.columnRules')}</th>
                      <th scope="col">{t('stats.columnOutcome')}</th>
                      <th scope="col">{t('stats.columnScore')}</th>
                      <th scope="col">{t('stats.columnRoomsCleared')}</th>
                      <th scope="col">
                        <span className="visually-hidden">{t('stats.replay')}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((entry) => (
                      <tr key={entry.runId} data-run-id={entry.runId}>
                        <td className="history-table__date">
                          {formatHistoryDate(locale, entry.finishedAt)}
                        </td>
                        <td className="history-table__seed">
                          <code>{entry.seed}</code>
                        </td>
                        <td>{formatRulesDescription(t, locale, entry.config)}</td>
                        <td>
                          <span
                            className={cnOutcome(entry.outcome, entry.abandoned)}
                            data-testid="history-outcome"
                          >
                            {historyOutcomeText(t, entry.outcome, entry.abandoned)}
                          </span>
                        </td>
                        <td className="history-table__score data-table__numeric">
                          {formatNumber(locale, entry.score)}
                        </td>
                        <td className="data-table__numeric">
                          {formatNumber(locale, entry.roomsCleared)}
                        </td>
                        <td>
                          <Button
                            variant="ghost"
                            className="history-table__replay"
                            aria-label={t('stats.replayLabel', { seed: entry.seed })}
                            onClick={() => onReplay(entry.runId)}
                          >
                            {t('stats.replay')}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="screen-panel__note">{t('stats.historyNote')}</p>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

function cnOutcome(outcome: 'won' | 'lost', abandoned: boolean): string {
  if (abandoned) return 'history-outcome history-outcome--abandoned';
  return outcome === 'won'
    ? 'history-outcome history-outcome--won'
    : 'history-outcome history-outcome--lost';
}
