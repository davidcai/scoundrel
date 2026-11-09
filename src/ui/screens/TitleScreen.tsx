import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { type CardId, type RuleConfig, type RuleOptions } from '../../engine';
import { startFailureText, type StartFailureReason } from '../../i18n/messages';
import type { ActiveRunView } from '../../store';
import { configFromOptions } from '../../store/selectors';
import { usePreferences } from '../../store/preferences';
import { artworkFor } from '../artwork';
import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { HelpDialog } from '../components/HelpDialog';
import { APP_VERSION } from '../version';

/** A failed start returns its reason; `null` means the app navigated away. */
export type StartOutcome = StartFailureReason | null;

export interface TitleScreenProps {
  activeRun: ActiveRunView | null;
  hasCompletedResult: boolean;
  onNewRun: (config: RuleConfig) => StartOutcome;
  onContinue: () => StartOutcome;
  onStartSeed: (seed: string, config: RuleConfig) => StartOutcome;
  onViewLastResult: () => void;
  onOpenStatistics: () => void;
  onOpenSettings: () => void;
  ruleOptions: RuleOptions;
}

/** Decorative, aria-hidden fan of current PNG artwork outside the text column. */
const TITLE_FAN: readonly CardId[] = ['spade-k', 'club-q', 'diamond-10'];

/**
 * Title screen: resume or start runs, enter a seed, open
 * statistics/settings/help; house rules live in settings. Starting a run replaces an
 * unfinished one after a discard confirmation and records exactly one abandoned
 * loss (REQ-001).
 */
export function TitleScreen({
  activeRun,
  hasCompletedResult,
  onNewRun,
  onContinue,
  onStartSeed,
  onViewLastResult,
  onOpenStatistics,
  onOpenSettings,
  ruleOptions,
}: TitleScreenProps) {
  const { t } = usePreferences();
  const [helpOpen, setHelpOpen] = useState(false);
  const [seedOpen, setSeedOpen] = useState(false);
  const [seedValue, setSeedValue] = useState('');
  const [seedError, setSeedError] = useState<StartOutcome>(null);
  const [startError, setStartError] = useState<StartOutcome>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [discardError, setDiscardError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const seedFormId = useId();
  const seedInputId = useId();
  const seedHintId = useId();
  const seedErrorId = useId();

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const config = () => configFromOptions(ruleOptions);
  const startNewRun = () => {
    setStartError(null);
    if (activeRun !== null) {
      setDiscardOpen(true);
      return;
    }
    setStartError(onNewRun(config()));
  };

  const handleContinue = () => {
    const failure = onContinue();
    if (failure !== null) setStartError(failure);
  };

  const closeSeedDialog = () => {
    setSeedOpen(false);
    setSeedError(null);
  };

  const handleSeedSubmit = (event: FormEvent) => {
    event.preventDefault();
    const failure = onStartSeed(seedValue, config());
    setSeedError(failure);
  };

  const handleDiscardConfirm = () => {
    const failure = onNewRun(config());
    if (failure === null) {
      setDiscardOpen(false);
      setDiscardError(null);
      return;
    }
    setDiscardError(startFailureText(t, failure));
  };

  return (
    <div className="title-screen">
      <div className="title-screen__art" aria-hidden="true">
        {TITLE_FAN.map((card, index) => (
          <img
            key={card}
            className={`title-screen__art-card title-screen__art-card--${index + 1}`}
            src={artworkFor(card)}
            alt=""
            width={1024}
            height={1536}
            decoding="async"
          />
        ))}
      </div>

      <main className="title-screen__main" aria-labelledby="title-heading">
        <h1
          className="wordmark title-screen__wordmark"
          id="title-heading"
          tabIndex={-1}
          ref={headingRef}
        >
          {t('app.title')}
        </h1>
        <p className="title-screen__premise">{t('app.premise')}</p>

        <div className="title-screen__actions">
          {activeRun !== null ? (
            <div className="title-screen__continue">
              <Button variant="primary" onClick={handleContinue}>
                {t('title.continue')}
              </Button>
            </div>
          ) : null}

          <Button variant={activeRun === null ? 'primary' : 'secondary'} onClick={startNewRun}>
            {t('title.newRun')}
          </Button>
          {startError !== null ? (
            <p className="field-error" data-testid="start-error">
              {startFailureText(t, startError)}
            </p>
          ) : null}

          {hasCompletedResult ? (
            <Button variant="ghost" onClick={onViewLastResult}>
              {t('title.lastResult')}
            </Button>
          ) : null}

          <div className="title-screen__entries">
            <Button variant="ghost" aria-haspopup="dialog" onClick={() => setSeedOpen(true)}>
              {t('title.enterSeed')}
            </Button>
            <Button variant="secondary" onClick={onOpenStatistics}>
              {t('title.statistics')}
            </Button>
            <Button variant="ghost" onClick={onOpenSettings}>
              {t('title.settings')}
            </Button>
            <Button variant="ghost" onClick={() => setHelpOpen(true)}>
              {t('title.rulesHelp')}
            </Button>
          </div>
        </div>
      </main>

      <footer className="title-screen__footer">
        <p>{t('title.footer', { version: APP_VERSION })}</p>
      </footer>

      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />

      <Dialog
        open={seedOpen}
        titleId="seed-dialog-title"
        onClose={closeSeedDialog}
        closeLabel={t('title.closeDialog')}
      >
        <div className="dialog__header">
          <h2 className="dialog__title" id="seed-dialog-title">
            {t('title.enterSeed')}
          </h2>
        </div>
        <form
          className="title-screen__form title-screen__form--dialog"
          id={seedFormId}
          onSubmit={handleSeedSubmit}
        >
          <label className="field-label" htmlFor={seedInputId}>
            {t('title.seedLabel')}
          </label>
          <input
            className="text-input"
            id={seedInputId}
            type="text"
            value={seedValue}
            placeholder={t('title.seedPlaceholder')}
            aria-invalid={seedError !== null}
            aria-describedby={`${seedHintId}${seedError !== null ? ` ${seedErrorId}` : ''}`}
            onChange={(event) => {
              setSeedValue(event.target.value);
              setSeedError(null);
            }}
          />
          <p className="field-hint" id={seedHintId}>
            {t('title.seedHint')}
          </p>
          {seedError !== null ? (
            <p className="field-error" id={seedErrorId} data-testid="seed-error">
              {startFailureText(t, seedError)}
            </p>
          ) : null}
          <Button type="submit" variant="primary">
            {t('title.startWithSeed')}
          </Button>
        </form>
      </Dialog>

      <Dialog
        open={discardOpen}
        titleId="discard-run-title"
        onClose={() => {
          setDiscardOpen(false);
          setDiscardError(null);
        }}
        closeLabel={t('title.closeDialog')}
      >
        <div className="dialog__header">
          <h2 className="dialog__title" id="discard-run-title">
            {t('title.discardTitle')}
          </h2>
        </div>
        <p className="dialog__body">{t('title.discardBody')}</p>
        {discardError !== null ? (
          <p className="field-error" data-testid="discard-error">
            {discardError}
          </p>
        ) : null}
        <div className="dialog__actions">
          <Button variant="secondary" onClick={() => setDiscardOpen(false)}>
            {t('title.discardCancel')}
          </Button>
          <Button variant="danger" onClick={handleDiscardConfirm}>
            {t('title.discardConfirm')}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
