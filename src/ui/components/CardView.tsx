import type { CardId } from '../../engine';
import { cardAriaLabel, cardType } from '../../engine';
import { cardArtUrl } from '../cardArt';

interface CardViewProps {
  cardId: CardId;
  selected: boolean;
  carried: boolean;
  onClick: () => void;
  disabled?: boolean;
}

export function CardView({ cardId, selected, carried, onClick, disabled }: CardViewProps) {
  const url = cardArtUrl(cardId);
  const type = cardType(cardId);
  const className = 'card card-' + type + (selected ? ' selected' : '') + (carried ? ' carried' : '');
  return (
    <button
      type='button'
      className={className}
      onClick={onClick}
      disabled={disabled}
      aria-label={cardAriaLabel(cardId)}
      aria-pressed={selected}
    >
      {url ? (
        <img src={url} alt='' className='card-art' draggable={false} />
      ) : (
        <span className='card-fallback'>{cardId}</span>
      )}
      {carried && <span className='carried-badge'>carried</span>}
    </button>
  );
}
