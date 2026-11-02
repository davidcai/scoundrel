import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_RULE_CONFIG,
  ruleOptions,
  type CardId,
  type RuleConfig,
  type RuleOptionName,
  type RuleOptions,
} from '../../engine';
import { RULE_HINT_KEYS, RULE_LABEL_KEYS, RULE_OPTION_ORDER } from '../../i18n/messages';
import { configFromOptions } from '../../store/selectors';
import { usePreferences } from '../../store/preferences';
import { artworkFor } from '../artwork';
import { Button } from '../components/Button';
import { HelpDialog } from '../components/HelpDialog';
import { APP_VERSION } from '../version';

export interface TitleScreenProps {
  onStart: (config: RuleConfig) => void;
}

/** Decorative, aria-hidden fan of current PNG artwork outside the text column. */
const TITLE_FAN: readonly CardId[] = ['spade-k', 'club-q', 'diamond-10'];

/**
 * Phase 3 title: start a run, choose house rules, switch language, open help.
 * Phase 4 controls (Continue, Enter Seed, Stats, Settings, replay links) are
 * deliberately absent until their phase is implemented.
 */
export function TitleScreen({ onStart }: TitleScreenProps) {
  const { t, locale, setLocale } = usePreferences();
  const [options, setOptions] = useState<RuleOptions>(() => ruleOptions(DEFAULT_RULE_CONFIG));
  const [helpOpen, setHelpOpen] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const toggle = (name: RuleOptionName) => {
    setOptions((previous) => ({ ...previous, [name]: !previous[name] }));
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
          <Button variant="primary" onClick={() => onStart(configFromOptions(options))}>
            {t('title.newRun')}
          </Button>
          <Button variant="ghost" onClick={() => setHelpOpen(true)}>
            {t('title.rulesHelp')}
          </Button>
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
    </div>
  );
}
