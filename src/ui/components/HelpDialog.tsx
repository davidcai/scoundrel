import { usePreferences } from '../../store/preferences';
import { APP_VERSION } from '../version';
import { Button } from './Button';
import { Dialog } from './Dialog';

const HELP_TITLE_ID = 'help-dialog-title';

/** Contextual rules help plus language and reduced-motion preferences (REQ-015). */
export function HelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, localePreference, setLocale, reducedMotion, setReducedMotion } = usePreferences();

  return (
    <Dialog open={open} titleId={HELP_TITLE_ID} onClose={onClose} className="dialog__panel--help">
      <div className="dialog__header">
        <h2 className="dialog__title" id={HELP_TITLE_ID}>
          {t('help.title')}
        </h2>
        <Button variant="ghost" onClick={onClose} aria-label={t('help.close')}>
          {t('help.close')}
        </Button>
      </div>

      <div className="help__body">
        <p>{t('help.intro')}</p>

        <section>
          <h3>{t('help.cardsTitle')}</h3>
          <p>{t('help.monster')}</p>
          <p>{t('help.weaponCard')}</p>
          <p>{t('help.potion')}</p>
        </section>

        <section>
          <h3>{t('help.degradationTitle')}</h3>
          <p>{t('help.degradation')}</p>
        </section>

        <section>
          <h3>{t('help.escapeTitle')}</h3>
          <p>{t('help.escape')}</p>
        </section>

        <section>
          <h3>{t('help.undoTitle')}</h3>
          <p>{t('help.undo')}</p>
        </section>

        <section>
          <h3>{t('help.aboutTitle')}</h3>
          <p>{t('help.about')}</p>
        </section>

        <section className="help__preferences">
          <h3>{t('language.group')}</h3>
          <div className="language-toggle" role="group" aria-label={t('language.group')}>
            <Button
              variant="ghost"
              aria-pressed={localePreference === 'en'}
              onClick={() => setLocale('en')}
            >
              {t('language.english')}
            </Button>
            <Button
              variant="ghost"
              aria-pressed={localePreference === 'zh-Hans'}
              onClick={() => setLocale('zh-Hans')}
            >
              {t('language.chinese')}
            </Button>
          </div>
          <label className="help__motion">
            <input
              type="checkbox"
              checked={reducedMotion}
              onChange={(event) => setReducedMotion(event.target.checked)}
            />
            {t('help.reduceMotion')}
          </label>
        </section>

        <p className="help__version">{t('help.version', { version: APP_VERSION })}</p>
      </div>
    </Dialog>
  );
}
