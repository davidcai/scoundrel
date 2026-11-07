import type { AttackMode } from '../../engine';
import {
  describeCardPreview,
  describeMonsterPreview,
  formatMonsterMatchupTitle,
  formatPreviewTitle,
  rejectionText,
} from '../../i18n/messages';
import { usePreferences } from '../../store/preferences';
import type { UiSession } from '../../store/gameSession';
import { Button } from './Button';

export interface PreviewPanelProps {
  session: UiSession;
  titleId: string;
  onConfirm: (attack?: AttackMode) => void;
}

/**
 * Selected-card preview with an explicit confirmation step (REQ-005). Monster
 * selections always keep the barehanded option; ineligible weapon attacks are
 * shown with their restriction but stay visible.
 */
export function PreviewPanel({ session, titleId, onConfirm }: PreviewPanelProps) {
  const { t } = usePreferences();
  const { preview, previewRejection, state } = session;
  const weaponValue = state.weapon?.value ?? null;

  if (previewRejection !== null) {
    return (
      <section className="preview" aria-labelledby={titleId}>
        <h2 className="preview__title" id={titleId}>
          {t('preview.title')}
        </h2>
        <p className="preview__rejected">
          {t('preview.rejected', { reason: rejectionText(t, previewRejection) })}
        </p>
      </section>
    );
  }

  if (preview === null) {
    return (
      <section className="preview" aria-labelledby={titleId}>
        <h2 className="preview__title" id={titleId}>
          {t('preview.title')}
        </h2>
        <p className="preview__empty">{t('play.previewEmpty')}</p>
      </section>
    );
  }

  if (preview.kind === 'monster') {
    const monster = preview.preview;
    const weaponEligible = monster.weapon !== null && monster.weapon.eligible;
    return (
      <section className="preview" aria-labelledby={titleId}>
        <h2 className="preview__title" id={titleId}>
          {formatMonsterMatchupTitle(t, monster, weaponValue)}
        </h2>
        <p className="preview__description">{describeMonsterPreview(t, monster, weaponValue)}</p>
        {weaponEligible ? (
          <p className="preview__status preview__status--weapon">{t('preview.weaponUsable')}</p>
        ) : null}
        {monster.weapon === null ? <p className="preview__hint">{t('preview.noWeapon')}</p> : null}
        <div className="preview__actions">
          {monster.weapon !== null ? (
            <Button
              variant={weaponEligible ? 'primary' : 'secondary'}
              aria-disabled={weaponEligible ? undefined : true}
              onClick={weaponEligible ? () => onConfirm('weapon') : undefined}
            >
              {weaponEligible
                ? t('action.useWeaponWithDamage', { damage: monster.weapon.damage })
                : t('action.useWeapon')}
            </Button>
          ) : null}
          <Button
            variant={monster.weapon === null ? 'primary' : 'secondary'}
            onClick={() => onConfirm('barehanded')}
          >
            {t('action.fightBarehandedWithDamage', { damage: monster.barehanded.damage })}
          </Button>
        </div>
      </section>
    );
  }

  const event = preview.event;
  const cardKind = event.type === 'cardResolved' ? event.cardKind : null;
  const description = describeCardPreview(t, preview, {
    health: state.health,
    weaponValue,
  });

  let confirmLabel = t('action.equipWeapon');
  if (cardKind === 'potion') confirmLabel = t('action.drinkPotion');
  if (cardKind === 'monster') confirmLabel = t('action.fightBarehanded');

  return (
    <section className="preview" aria-labelledby={titleId}>
      <h2 className="preview__title" id={titleId}>
        {formatPreviewTitle(t, preview.card)}
      </h2>
      <p className="preview__description">{description}</p>
      <div className="preview__actions">
        <Button variant="primary" onClick={() => onConfirm()}>
          {confirmLabel}
        </Button>
      </div>
    </section>
  );
}
