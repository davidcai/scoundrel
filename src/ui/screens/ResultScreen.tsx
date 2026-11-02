import { useEffect, useId, useRef } from 'react';
import type { RunResult } from '../../engine';
import { formatNumber } from '../../i18n';
import { formatRulesDescription } from '../../i18n/messages';
import { usePreferences } from '../../store/preferences';
import { useAnnounce } from '../components/Announcer';
import { Button } from '../components/Button';

export interface ResultScreenProps {
  result: RunResult;
  /** Monsters still in the draw pile when the run was lost (REQ-009/REQ-013). */
  remainingMonsters?: number;
  onNewRun: () => void;
  onBackToTitle: () => void;
}

/** Final result: outcome, score, seed, rules, and run highlights (REQ-009). */
export function ResultScreen({
  result,
  remainingMonsters = 0,
  onNewRun,
  onBackToTitle,
}: ResultScreenProps) {
  const { t, locale } = usePreferences();
  const announce = useAnnounce();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const highlightsTitleId = useId();

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
          {title}
        </h1>

        <p className="result-panel__row">
          <span className="result-label">{t('result.outcomeLabel')}</span>
          <span className="result-value">
            {won ? t('result.outcomeWon') : t('result.outcomeLost')}
          </span>
        </p>

        <p className="result-panel__row result-panel__row--score">
          <span className="result-label">{t('result.scoreLabel')}</span>
          <span className="result-score">{scoreText}</span>
        </p>

        <dl className="result-panel__details">
          <div className="result-panel__row">
            <dt>{t('result.healthLabel')}</dt>
            <dd>{formatNumber(locale, finalHealth)}</dd>
          </div>
          {won ? null : (
            <div className="result-panel__row">
              <dt>{t('result.remainingMonsters')}</dt>
              <dd>{formatNumber(locale, remainingMonsters)}</dd>
            </div>
          )}
          <div className="result-panel__row">
            <dt>{t('result.seedLabel')}</dt>
            <dd>
              <code>{result.seed}</code>
            </dd>
          </div>
          <div className="result-panel__row">
            <dt>{t('result.rulesLabel')}</dt>
            <dd>{formatRulesDescription(t, locale, result.config)}</dd>
          </div>
        </dl>

        <section className="result-panel__highlights" aria-labelledby={highlightsTitleId}>
          <h2 className="result-panel__highlights-title" id={highlightsTitleId}>
            {t('result.highlightsTitle')}
          </h2>
          <dl className="result-panel__details">
            <div className="result-panel__row">
              <dt>{t('result.monstersDefeated')}</dt>
              <dd>{formatNumber(locale, result.highlights.monstersDefeated)}</dd>
            </div>
            <div className="result-panel__row">
              <dt>{t('result.potionsWasted')}</dt>
              <dd>{formatNumber(locale, result.highlights.potionsWasted)}</dd>
            </div>
            <div className="result-panel__row">
              <dt>{t('result.roomsExplored')}</dt>
              <dd>{formatNumber(locale, result.highlights.roomsExplored)}</dd>
            </div>
            <div className="result-panel__row">
              <dt>{t('result.roomsCleared')}</dt>
              <dd>{formatNumber(locale, result.highlights.roomsCleared)}</dd>
            </div>
          </dl>
        </section>

        <div className="result-panel__actions">
          <Button variant="primary" onClick={onNewRun}>
            {t('result.newRun')}
          </Button>
          <Button variant="secondary" onClick={onBackToTitle}>
            {t('result.backToTitle')}
          </Button>
        </div>
      </main>
    </div>
  );
}
