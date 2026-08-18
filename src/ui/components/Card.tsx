/**
 * Card rendering per style guide §5: art full-bleed in a kept-corner frame,
 * badge chip + vignette own rank legibility, suit tint lives on the glyph
 * only, state rings are box-shadows (never outlines/borders on cards).
 */
import type { CardId } from '../../engine';
import { cardAriaLabel, rankLabel, SUIT_GLYPH, suitOfId } from '../cards/cardMeta';
import { cardArtUrl } from '../cards/cardArt';
import './card.css';

interface CardProps {
  cardId: CardId;
  size?: 'room' | 'hand' | 'thumb';
  interactive?: boolean;
  selected?: boolean;
  confirmArmed?: boolean;
  carried?: boolean;
  dimmed?: boolean;
  onActivate?: () => void;
  ariaDescribedBy?: string;
  forwardedRef?: (el: HTMLButtonElement | null) => void;
}

export function Card({
  cardId,
  size = 'room',
  interactive = false,
  selected = false,
  confirmArmed = false,
  carried = false,
  dimmed = false,
  onActivate,
  ariaDescribedBy,
  forwardedRef,
}: CardProps) {
  const suit = suitOfId(cardId);
  const artUrl = cardArtUrl(cardId);
  const label = cardAriaLabel(cardId);

  const body = (
    <>
      {artUrl !== undefined ? (
        <img className="card-art" src={artUrl} alt="" draggable={false} />
      ) : (
        <span className="card-art card-art--missing" data-suit={suit} aria-hidden="true">
          {SUIT_GLYPH[suit]}
        </span>
      )}
      <span className="card-vignette" aria-hidden="true" />
      <span className="card-badge" data-suit={suit} data-size={size}>
        <span className="card-badge-rank">{rankLabel(cardId)}</span>
        <span className="card-badge-glyph" aria-hidden="true">
          {SUIT_GLYPH[suit]}
        </span>
      </span>
      {carried && (
        <span className="card-carried" aria-hidden="true">
          <span className="card-carried-dot" />
          carried
        </span>
      )}
      {dimmed && <span className="card-dim" aria-hidden="true" />}
    </>
  );

  const className = [
    'card-frame',
    `card--${size}`,
    interactive ? 'card--interactive' : '',
    selected ? 'card--selected' : '',
    confirmArmed ? 'card--confirm' : '',
    dimmed ? 'card--dimmed' : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (!interactive) {
    return (
      <span className={className} data-card-id={cardId} aria-label={label}>
        {body}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={className}
      data-card-id={cardId}
      aria-label={label}
      aria-describedby={ariaDescribedBy}
      aria-pressed={selected}
      disabled={dimmed}
      onClick={onActivate}
      ref={forwardedRef}
    >
      {body}
    </button>
  );
}

/** Ghost slot where a resolved card used to sit (style guide §6.2). */
export function GhostSlot({ cardId }: { cardId: CardId }) {
  const suit = suitOfId(cardId);
  return (
    <span
      className="card-frame card--room card-ghost"
      aria-label={`Resolved ${cardAriaLabel(cardId)}`}
    >
      <span className="card-ghost-glyph" data-suit={suit} aria-hidden="true">
        {SUIT_GLYPH[suit]}
      </span>
    </span>
  );
}

/** Empty weapon well (style guide §6.2). */
export function EmptyWeaponSlot() {
  return (
    <span className="card-frame card--room card-ghost card-ghost--weapon" aria-hidden="true">
      <span className="card-ghost-glyph" data-suit="diamond">
        {SUIT_GLYPH.diamond}
      </span>
      <span className="card-ghost-hint">equip a ◆</span>
    </span>
  );
}
