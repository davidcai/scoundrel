import { usePreferences } from '../../store/preferences';
import { Dialog } from './Dialog';

const HELP_TITLE_ID = 'help-dialog-title';

/** Contextual rules help (REQ-015); preferences live in Settings. */
export function HelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = usePreferences();

  return (
    <Dialog
      open={open}
      titleId={HELP_TITLE_ID}
      onClose={onClose}
      className="dialog__panel--help"
      closeLabel={t('help.close')}
    >
      <div className="dialog__header">
        <h2 className="dialog__title" id={HELP_TITLE_ID}>
          {t('help.title')}
        </h2>
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
      </div>
    </Dialog>
  );
}
