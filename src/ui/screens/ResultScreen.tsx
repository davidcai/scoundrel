import { useEffect, useId, useRef } from 'react';
import type { RunResult } from '../../engine';
import { formatNumber } from '../../i18n';
import { formatRulesDescription } from '../../i18n/messages';
import { usePreferences } from '../../store/preferences';
import { useAnnounce } from '../components/Announcer';
import { Button } from '../components/Button';
import { cn } from '../cn';

export interface ResultScreenProps {
  result: RunResult;
  /** Monsters still in the draw pile when the run was lost (REQ-009/REQ-013). */
  remainingMonsters?: number;
  onNewRun: () => void;
  onBackToTitle: () => void;
  onViewStatistics: () => void;
}

/** Trophy mark for a won run; paired with the outcome text, never alone. */
function WonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4Z" strokeLinejoin="round" />
      <path d="M7 6H4a3 3 0 0 0 3 5M17 6h3a3 3 0 0 1-3 5" strokeLinecap="round" />
    </svg>
  );
}

/** Skull mark for a lost run; paired with the outcome text, never alone. */
function LostIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path
        d="M12 2a8 8 0 0 0-8 8c0 2.9 1.6 5.4 4 6.7V20a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-3.3c2.4-1.3 4-3.8 4-6.7a8 8 0 0 0-8-8Z"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * Final result: outcome, score, a breakdown table, seed, rules, and the
 * follow-up actions (REQ-009). Reloaded results render from
 * the saved completed result instead of an in-memory session.
 */
export function ResultScreen({
  result,
  remainingMonsters = 0,
  onNewRun,
  onBackToTitle,
  onViewStatistics,
}: ResultScreenProps) {
  const { t, locale } = usePreferences();
  const announce = useAnnounce();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const breakdownTitleId = useId();

  const won = result.outcome === 'won';
  const title = won ? t('result.wonTitle') : t('result.lostTitle');
  const scoreText = formatNumber(locale, result.score);
  // Death ends the run at or below zero health; never show negative health.
  const finalHealth = Math.max(0, result.health);

  useEffect(() => {
    headingRef.current?.focus();
    announce(
      won
        ? t('result.announceWon', { score: scoreText })
        : t('result.announceLost', { score: scoreText }),
      'polite',
    );
    // Announce once per mounted result screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="result-screen">
      <main className="result-panel" aria-labelledby="result-heading">
        <h1 className="result-panel__title" id="result-heading" tabIndex={-1} ref={headingRef}>
          <span
            className={cn(
              'result-panel__outcome-icon',
              won ? 'result-panel__outcome-icon--won' : 'result-panel__outcome-icon--lost',
            )}
            aria-hidden="true"
          >
            {won ? <WonIcon /> : <LostIcon />}
          </span>
          {title}
        </h1>

        <p className="result-panel__row result-panel__row--score">
          <span className="result-label">{t('result.scoreLabel')}</span>
          <span className="result-score">{scoreText}</span>
        </p>

        <section className="result-panel__breakdown">
          <h2 className="result-panel__section-title" id={breakdownTitleId}>
            {t('result.highlightsTitle')}
          </h2>
          <div className="table-scroll" role="region" aria-labelledby={breakdownTitleId}>
            <table className="data-table result-table">
              <thead>
                <tr>
                  <th scope="col">{t('result.tableDetail')}</th>
                  <th scope="col" className="data-table__numeric">
                    {t('result.tableValue')}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">{t('result.healthLabel')}</th>
                  <td className="data-table__numeric">{formatNumber(locale, finalHealth)}</td>
                </tr>
                {won ? null : (
                  <tr>
                    <th scope="row">{t('result.remainingMonsters')}</th>
                    <td className="data-table__numeric">
                      {formatNumber(locale, remainingMonsters)}
                    </td>
                  </tr>
                )}
                <tr>
                  <th scope="row">{t('result.monstersDefeated')}</th>
                  <td className="data-table__numeric">
                    {formatNumber(locale, result.highlights.monstersDefeated)}
                  </td>
                </tr>
                <tr>
                  <th scope="row">{t('result.potionsWasted')}</th>
                  <td className="data-table__numeric">
                    {formatNumber(locale, result.highlights.potionsWasted)}
                  </td>
                </tr>
                <tr>
                  <th scope="row">{t('result.roomsExplored')}</th>
                  <td className="data-table__numeric">
                    {formatNumber(locale, result.highlights.roomsExplored)}
                  </td>
                </tr>
                <tr>
                  <th scope="row">{t('result.roomsCleared')}</th>
                  <td className="data-table__numeric">
                    {formatNumber(locale, result.highlights.roomsCleared)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <dl className="result-panel__meta">
          <div className="result-panel__meta-row">
            <dt>{t('result.seedLabel')}</dt>
            <dd>
              <code>{result.seed}</code>
            </dd>
          </div>
          <div className="result-panel__meta-row">
            <dt>{t('result.rulesLabel')}</dt>
            <dd>{formatRulesDescription(t, locale, result.config)}</dd>
          </div>
        </dl>

        <div className="result-panel__actions">
          <Button variant="primary" onClick={onNewRun}>
            {t('result.newRun')}
          </Button>
          <Button variant="secondary" onClick={onBackToTitle}>
            {t('result.backToTitle')}
          </Button>
          <Button variant="ghost" onClick={onViewStatistics}>
            {t('result.viewStatistics')}
          </Button>
        </div>
      </main>
    </div>
  );
}
