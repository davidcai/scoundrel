import type { ReactNode } from 'react';
import { cardLabel } from '../../engine/rules';
import type { Card } from '../../engine/types';

interface CardViewProps {
  card: Card;
  onClick?: () => void;
  selected?: boolean;
  /** Overlay content (e.g. combat choices), shown when selected. */
  children?: ReactNode;
}

export function CardView({ card, onClick, selected, children }: CardViewProps) {
  const label = cardLabel(card);
  return (
    <div
      className={`card ${onClick ? 'card--clickable' : ''} ${selected ? 'card--selected' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      aria-label={label}
    >
      <img src={`/cards/${card.id}.svg`} alt={label} draggable={false} />
      {selected && children ? <div className="card-overlay">{children}</div> : null}
    </div>
  );
}
