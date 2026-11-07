import { formatCardName } from '../../i18n/messages';
import { formatList } from '../../i18n';
import { usePreferences } from '../../store/preferences';
import type { WeaponView } from '../../store/selectors';
import { useMeasuredWidth } from '../hooks/useMeasuredWidth';
import { CardFrame } from './CardFrame';

/** Design plan §5: 96px thumbnails overlapping by 52px, capped by rail width. */
function visibleCap(width: number): number {
  if (width >= 228) return 4;
  if (width >= 184) return 3;
  if (width >= 140) return 2;
  return 1;
}

/**
 * Weapon slot and kill stack. The stack exposes a text list and total so the
 * state never depends on the thumbnails (REQ-004, design plan §5/§7). The
 * newest defeat is the top/right thumbnail; the cap is measured on the rail
 * (not the thumbnails), so the 4/3/2 thumbnail rule applies to the actual
 * available width.
 */
export function WeaponRail({ view }: { view: WeaponView }) {
  const { t, locale } = usePreferences();
  const [railRef, railWidth] = useMeasuredWidth<HTMLDivElement>();
  const cap = visibleCap(railWidth);
  const visible = view.kills.slice(Math.max(0, view.kills.length - cap));
  const hiddenCount = view.kills.length - visible.length;
  const names = formatList(
    locale,
    view.kills.map((card) => formatCardName(t, card)),
  );

  return (
    <div className="weapon-rail" ref={railRef}>
      <section className="weapon" aria-label={t('a11y.weapon')}>
        <h2 className="rail-title">
          {view.weapon === null
            ? t('a11y.weapon')
            : t('play.weaponValue', { value: view.weapon.value })}
        </h2>
        {view.weapon === null ? (
          <div className="weapon__empty">
            <span className="weapon__empty-slot" aria-hidden="true" />
            <p className="rail-caption">{t('play.noWeapon')}</p>
            <p className="rail-hint">{t('play.noWeaponHint')}</p>
          </div>
        ) : (
          <div className="weapon__card">
            <CardFrame card={view.weapon.card} />
          </div>
        )}
      </section>

      <section className="kill-stack" aria-label={t('a11y.killStack')}>
        <h2 className="rail-title">{t('play.killStackTitle')}</h2>
        {view.kills.length === 0 ? (
          <p className="rail-caption">{t('play.killStackNone')}</p>
        ) : (
          <>
            <ul className="kill-stack__thumbs" aria-hidden="true">
              {visible.map((card, index) => (
                <li
                  key={card}
                  className="kill-stack__thumb"
                  style={
                    index === 0 ? { zIndex: index + 1 } : { marginLeft: -52, zIndex: index + 1 }
                  }
                >
                  <CardFrame card={card} />
                </li>
              ))}
            </ul>
            <p className="rail-caption">{t('play.killStackTotal', { count: view.kills.length })}</p>
            {hiddenCount > 0 ? (
              <p className="rail-caption">{t('play.killStackMore', { count: hiddenCount })}</p>
            ) : null}
            <p className="visually-hidden">{names}</p>
          </>
        )}
      </section>
    </div>
  );
}
