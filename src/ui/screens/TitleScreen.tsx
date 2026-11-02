import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import {
  DEFAULT_RULE_CONFIG,
  MAX_HEALTH,
  ruleOptions,
  type CardId,
  type RuleConfig,
  type RuleOptionName,
  type RuleOptions,
} from '../../engine';
import {
  RULE_HINT_KEYS,
  RULE_LABEL_KEYS,
  RULE_OPTION_ORDER,
  startFailureText,
  type StartFailureReason,
} from '../../i18n/messages';
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
  onStartLink: (input: string, config: RuleConfig) => StartOutcome;
  onDiscard: () => StartOutcome;
  onViewLastResult: () => void;
  onOpenStatistics: () => void;
  onOpenSettings: () => void;
}

/** Decorative, aria-hidden fan of current PNG artwork outside the text column. */
const TITLE_FAN: readonly CardId[] = ['spade-k', 'club-q', 'diamond-10'];

/**
 * Title screen: resume or start runs, enter a seed or replay link, open
 * statistics/settings/help, and choose house rules. Starting a run replaces an
 * unfinished one without confirmation and records exactly one abandoned loss
 * (REQ-001); discarding asks first.
 */
export function TitleScreen({
  activeRun,
  hasCompletedResult,
  onNewRun,
  onContinue,
  onStartSeed,
  onStartLink,
  onDiscard,
  onViewLastResult,
  onOpenStatistics,
  onOpenSettings,
}: TitleScreenProps) {
  const { t, locale, setLocale } = usePreferences();
  const [options, setOptions] = useState<RuleOptions>(() => ruleOptions(DEFAULT_RULE_CONFIG));
  const [helpOpen, setHelpOpen] = useState(false);
  const [seedOpen, setSeedOpen] = useState(false);
  const [seedValue, setSeedValue] = useState('');
  const [seedError, setSeedError] = useState<StartOutcome>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState('');
  const [linkError, setLinkError] = useState<StartOutcome>(null);
  const [startError, setStartError] = useState<StartOutcome>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [discardError, setDiscardError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const seedFormId = useId();
  const seedInputId = useId();
  const seedHintId = useId();
  const seedErrorId = useId();
  const linkFormId = useId();
  const linkInputId = useId();
  const linkHintId = useId();
  const linkErrorId = useId();

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const toggle = (name: RuleOptionName) => {
    setOptions((previous) => ({ ...previous, [name]: !previous[name] }));
  };

  const config = () => configFromOptions(options);

  const handleContinue = () => {
    const failure = onContinue();
    if (failure !== null) setStartError(failure);
  };

  const handleSeedSubmit = (event: FormEvent) => {
    event.preventDefault();
    const failure = onStartSeed(seedValue, config());
    setSeedError(failure);
  };

  const handleLinkSubmit = (event: FormEvent) => {
    event.preventDefault();
    const failure = onStartLink(linkValue, config());
    setLinkError(failure);
  };

  const handleDiscardConfirm = () => {
    const failure = onDiscard();
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
              <p className="title-screen__continue-detail">
                {t('title.continueDetail', {
                  room: activeRun.state.highlights.roomsExplored,
                  health: activeRun.state.health,
                  max: MAX_HEALTH,
                  seed: activeRun.state.seed,
                })}
              </p>
              <Button variant="ghost" onClick={() => setDiscardOpen(true)}>
                {t('title.discardRun')}
              </Button>
            </div>
          ) : null}

          <Button
            variant={activeRun === null ? 'primary' : 'secondary'}
            onClick={() => setStartError(onNewRun(config()))}
          >
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
            <Button
              variant="ghost"
              aria-expanded={seedOpen}
              aria-controls={seedFormId}
              onClick={() => setSeedOpen((open) => !open)}
            >
              {t('title.enterSeed')}
            </Button>
            <Button
              variant="ghost"
              aria-expanded={linkOpen}
              aria-controls={linkFormId}
              onClick={() => setLinkOpen((open) => !open)}
            >
              {t('title.replayLink')}
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

          <div className="language-toggle" role="group" aria-label={t('language.group')}>
            <Button variant="ghost" aria-pressed={locale === 'en'} onClick={() => setLocale('en')}>
              {t('language.english')}
            </Button>
            <Button
              variant="ghost"
              aria-pressed={locale === 'zh-Hans'}
              onClick={() => setLocale('zh-Hans')}
            >
              {t('language.chinese')}
            </Button>
          </div>
        </div>

        {seedOpen ? (
          <form className="title-screen__form" id={seedFormId} onSubmit={handleSeedSubmit}>
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
        ) : null}

        {linkOpen ? (
          <form className="title-screen__form" id={linkFormId} onSubmit={handleLinkSubmit}>
            <label className="field-label" htmlFor={linkInputId}>
              {t('title.linkLabel')}
            </label>
            <input
              className="text-input"
              id={linkInputId}
              type="text"
              value={linkValue}
              placeholder={t('title.linkPlaceholder')}
              aria-invalid={linkError !== null}
              aria-describedby={`${linkHintId}${linkError !== null ? ` ${linkErrorId}` : ''}`}
              onChange={(event) => {
                setLinkValue(event.target.value);
                setLinkError(null);
              }}
            />
            <p className="field-hint" id={linkHintId}>
              {t('title.linkHint')}
            </p>
            {linkError !== null ? (
              <p className="field-error" id={linkErrorId} data-testid="link-error">
                {startFailureText(t, linkError)}
              </p>
            ) : null}
            <Button type="submit" variant="primary">
              {t('title.openLink')}
            </Button>
          </form>
        ) : null}

        <fieldset className="title-screen__rules">
          <legend className="title-screen__rules-title">{t('title.rulesOptions')}</legend>
          {RULE_OPTION_ORDER.map((name) => (
            <label key={name} className="rule-option">
              <input type="checkbox" checked={options[name]} onChange={() => toggle(name)} />
              <span className="rule-option__label">{t(RULE_LABEL_KEYS[name])}</span>
              <span className="rule-option__hint">{t(RULE_HINT_KEYS[name])}</span>
            </label>
          ))}
        </fieldset>
      </main>

      <footer className="title-screen__footer">
        <p>{t('title.footer', { version: APP_VERSION })}</p>
      </footer>

      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />

      <Dialog
        open={discardOpen}
        titleId="discard-run-title"
        onClose={() => setDiscardOpen(false)}
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
          <Button variant="primary" onClick={handleDiscardConfirm}>
            {t('title.discardConfirm')}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
