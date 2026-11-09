import { forwardRef } from 'react';
import {
  formatCardAccessibleName,
  formatCardCaption,
  formatCardName,
  formatCardType,
} from '../../i18n/messages';
import { usePreferences } from '../../store/preferences';
import type { CardView } from '../../store/selectors';
import { cn } from '../cn';
import { CardFrame } from './CardFrame';

export interface CardTileProps {
  view: CardView;
  tabIndex: number;
  onSelect: (card: CardView['card']) => void;
  onFocus: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
}

/**
 * Room card as a native button. Selection is not resolution: selecting only
 * previews, while an explicit confirmation resolves (REQ-005, REQ-007).
 */
export const CardTile = forwardRef<HTMLButtonElement, CardTileProps>(function CardTile(
  { view, tabIndex, onSelect, onFocus, onKeyDown },
  ref,
) {
  const { t } = usePreferences();
  const caption = formatCardCaption(t, { kind: view.kind });
  const accessibleName = formatCardAccessibleName(t, {
    card: view.card,
    kind: view.kind,
    selected: view.selected,
    carried: view.carried,
    reason: view.reason,
  });

  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        'card',
        view.selected && 'card--selected',
        view.reason !== null && 'card--ineligible',
      )}
      tabIndex={tabIndex}
      data-card={view.card}
      aria-pressed={view.selected}
      aria-disabled={view.reason === null ? undefined : true}
      aria-label={accessibleName}
      onClick={() => onSelect(view.card)}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
    >
      <CardFrame
        card={view.card}
        className="card__frame--tile"
        badge={view.carried ? t('card.state.carried') : undefined}
      />
      {/* Narrow-screen fallback (below 132px cards) renders metadata rows. */}
      <span className="card__meta" aria-hidden="true">
        <span className="card__meta-name">{formatCardName(t, view.card)}</span>
        <span className="card__meta-detail">
          {formatCardType(t, view.kind)}
          {t('card.captionSeparator')}
          {view.value}
          {view.carried ? t('card.captionSeparator') : null}
          {view.carried ? t('card.state.carried') : null}
        </span>
      </span>
      <span className="card__caption">{caption}</span>
    </button>
  );
});
