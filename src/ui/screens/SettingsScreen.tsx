/**
 * Settings screen: persisted language and reduced-motion preferences
 * (REQ-010/REQ-012) plus the read-only build version.
 */
import { useEffect, useId, useRef } from 'react';
import { usePreferences } from '../../store/preferences';
import { Button } from '../components/Button';
import { APP_VERSION } from '../version';

export interface SettingsScreenProps {
  onBackToTitle: () => void;
}

export function SettingsScreen({ onBackToTitle }: SettingsScreenProps) {
  const { t, locale, reducedMotion, setLocale, setReducedMotion } = usePreferences();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const languageTitleId = useId();
  const motionTitleId = useId();
  const motionHintId = useId();

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="screen-screen">
      <main className="screen-panel" aria-labelledby="settings-heading">
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

        <p className="screen-panel__note">{t('settings.version', { version: APP_VERSION })}</p>

        <div className="screen-panel__actions">
          <Button variant="secondary" onClick={onBackToTitle}>
            {t('settings.backToTitle')}
          </Button>
        </div>
      </main>
    </div>
  );
}
