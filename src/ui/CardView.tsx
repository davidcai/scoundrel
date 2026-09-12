import { useState } from 'react';
import { cardAriaLabel, cardKind, cardSymbol, cardValue, type CardId } from '../engine';
import { cardImageUrl } from './cardImage';

interface CardViewProps {
  cardId: CardId;
  selected?: boolean;
  carried?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}

/**
 * A physical card: committed artwork + corner value/suit badge + ARIA label.
 * If the artwork fails to load, a readable CSS fallback (rank + suit on a
 * suit-toned panel) is shown instead of a broken-image glyph.
 */
export function CardView({
  cardId,
  selected,
  carried,
  disabled,
  onClick,
  className,
}: CardViewProps) {
  const kind = cardKind(cardId);
  const [imageFailed, setImageFailed] = useState(false);
  const showFallback = imageFailed || cardImageUrl(cardId) === '';

  return (
    <button
      type="button"
      className={`card ${className ?? ''}`}
      data-card-id={cardId}
      data-kind={kind}
      data-selected={selected === true}
      aria-pressed={selected}
      aria-label={cardAriaLabel(cardId) + (carried ? ', carried from the previous room' : '')}
      disabled={disabled}
      onClick={onClick}
    >
      {showFallback ? (
        <span className="card-fallback" aria-hidden="true">
          <span className="card-fallback-value">{cardValue(cardId)}</span>
          <span className="card-fallback-suit">{cardSymbol(cardId)}</span>
        </span>
      ) : (
        <img
          src={cardImageUrl(cardId)}
          alt=""
          draggable={false}
          onError={() => setImageFailed(true)}
        />
      )}
      {carried && <span className="carried-badge">Carried</span>}
      {selected && <span className="selected-ring" aria-hidden="true" />}
    </button>
  );
}
