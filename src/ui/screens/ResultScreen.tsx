import { useEffect, useId, useRef, useState } from 'react';
import type { RunResult } from '../../engine';
import { formatNumber } from '../../i18n';
import { formatRulesDescription } from '../../i18n/messages';
import { usePreferences } from '../../store/preferences';
import { useScoundrelStore } from '../../store/useScoundrelStore';
import { useAnnounce } from '../components/Announcer';
import { Button } from '../components/Button';

export interface ResultScreenProps {
  result: RunResult;
  /** Monsters still in the draw pile when the run was lost (REQ-009/REQ-013). */
  remainingMonsters?: number;
  onNewRun: () => void;
  onBackToTitle: () => void;
  onViewStatistics: () => void;
}

function replayBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}${window.location.pathname}`;
}

/**
 * Final result: outcome, score, seed, rules, highlights, replay link, and the
 * follow-up actions (REQ-009/REQ-014). Reloaded results render from the saved
 * completed result instead of an in-memory session.
 */
export function ResultScreen({
  result,
  remainingMonsters = 0,
  onNewRun,
  onBackToTitle,
  onViewStatistics,
}: ResultScreenProps) {
  const { t, locale } = usePreferences();
  const store = useScoundrelStore();
  const announce = useAnnounce();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const highlightsTitleId = useId();
  const replayTitleId = useId();
  const replayInputId = useId();
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const won = result.outcome === 'won';
  const title = won ? t('result.wonTitle') : t('result.lostTitle');
  const scoreText = formatNumber(locale, result.score);
  // Death ends the run at or below zero health; never show negative health.
  const finalHealth = Math.max(0, result.health);
  const replayLink = store.buildReplayUrl(result.seed, result.config, replayBaseUrl());

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

  const handleCopy = () => {
    const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
    if (clipboard === undefined || typeof clipboard.writeText !== 'function') {
      setCopyState('failed');
      announce(t('result.linkCopyFailed'), 'assertive');
      return;
    }
    void clipboard
      .writeText(replayLink)
      .then(() => {
        setCopyState('copied');
        announce(t('result.linkCopied'), 'polite');
      })
      .catch(() => {
        setCopyState('failed');
        announce(t('result.linkCopyFailed'), 'assertive');
      });
  };

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

        <section className="result-panel__replay" aria-labelledby={replayTitleId}>
          <h2 className="result-panel__highlights-title" id={replayTitleId}>
            {t('result.replayLinkLabel')}
          </h2>
          <label className="visually-hidden" htmlFor={replayInputId}>
            {t('result.replayLinkLabel')}
          </label>
          <input
            className="text-input text-input--link"
            id={replayInputId}
            type="text"
            readOnly
            value={replayLink}
            onFocus={(event) => event.currentTarget.select()}
          />
          <div className="result-panel__replay-actions">
            <Button variant="secondary" onClick={handleCopy}>
              {t('result.copyLink')}
            </Button>
            <p
              className={
                copyState === 'failed'
                  ? 'result-panel__copy-state field-error'
                  : 'result-panel__copy-state'
              }
              data-testid="copy-state"
            >
              {copyState === 'copied'
                ? t('result.linkCopied')
                : copyState === 'failed'
                  ? t('result.linkCopyFailed')
                  : ''}
            </p>
          </div>
        </section>

        <div className="result-panel__actions">
          <Button variant="primary" onClick={onNewRun}>
            {t('result.newRun')}
          </Button>
          <Button variant="secondary" onClick={onViewStatistics}>
            {t('result.viewStatistics')}
          </Button>
          <Button variant="ghost" onClick={onBackToTitle}>
            {t('result.backToTitle')}
          </Button>
        </div>
      </main>
    </div>
  );
}
