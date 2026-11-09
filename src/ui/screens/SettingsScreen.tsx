/**
 * Settings screen: persisted language and reduced-motion preferences
 * (REQ-010/REQ-012), the per-run house-rule options, and the read-only build
 * version. House rules are held by the app shell so they survive a round trip
 * through this screen and apply to the next run.
 */
import { useEffect, useId, useRef } from 'react';
import type { RuleOptionName, RuleOptions } from '../../engine';
import { RULE_HINT_KEYS, RULE_LABEL_KEYS, RULE_OPTION_ORDER } from '../../i18n/messages';
import { usePreferences } from '../../store/preferences';
import { Button } from '../components/Button';
import { APP_VERSION } from '../version';

export interface SettingsScreenProps {
  ruleOptions: RuleOptions;
  onToggleRule: (name: RuleOptionName) => void;
  onClose: () => void;
}

export function SettingsScreen({ ruleOptions, onToggleRule, onClose }: SettingsScreenProps) {
  const { t, locale, reducedMotion, setLocale, setReducedMotion } = usePreferences();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const languageTitleId = useId();
  const motionTitleId = useId();
  const motionHintId = useId();
  const rulesTitleId = useId();

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="screen-screen">
      <main className="screen-panel" aria-labelledby="settings-heading">
        <Button
          variant="ghost"
          className="screen-panel__close"
          aria-label={t('settings.close')}
          onClick={onClose}
        >
          <span aria-hidden="true">×</span>
        </Button>
        <h1 className="screen-panel__title" id="settings-heading" tabIndex={-1} ref={headingRef}>
          {t('settings.title')}
        </h1>

        <section className="settings-section" aria-labelledby={languageTitleId}>
          <h2 className="screen-panel__section-title" id={languageTitleId}>
            {t('settings.language')}
          </h2>
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
        </section>

        <section className="settings-section" aria-labelledby={motionTitleId}>
          <h2 className="screen-panel__section-title" id={motionTitleId}>
            {t('settings.motionTitle')}
          </h2>
          <label className="settings-checkbox">
            <input
              type="checkbox"
              checked={reducedMotion}
              aria-describedby={motionHintId}
              onChange={(event) => setReducedMotion(event.target.checked)}
            />
            <span>{t('settings.reduceMotion')}</span>
          </label>
          <p className="screen-panel__note" id={motionHintId}>
            {t('settings.motionHint')}
          </p>
        </section>

        <section className="settings-section" aria-labelledby={rulesTitleId}>
          <h2 className="screen-panel__section-title" id={rulesTitleId}>
            {t('title.rulesOptions')}
          </h2>
          <fieldset className="rules-options">
            <legend className="visually-hidden">{t('title.rulesOptions')}</legend>
            {RULE_OPTION_ORDER.map((name) => (
              <label key={name} className="rule-option">
                <input
                  type="checkbox"
                  checked={ruleOptions[name]}
                  onChange={() => onToggleRule(name)}
                />
                <span className="rule-option__label">{t(RULE_LABEL_KEYS[name])}</span>
                <span className="rule-option__hint">{t(RULE_HINT_KEYS[name])}</span>
              </label>
            ))}
          </fieldset>
        </section>

        <p className="screen-panel__note">{t('settings.version', { version: APP_VERSION })}</p>
      </main>
    </div>
  );
}
