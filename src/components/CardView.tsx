import type { ReactNode } from 'react';
import type { Card, CardKind, Suit } from '../engine/types';

export function rankLabel(rank: number): string {
  switch (rank) {
    case 11:
      return 'J';
    case 12:
      return 'Q';
    case 13:
      return 'K';
    case 14:
      return 'A';
    default:
      return String(rank);
  }
}

export function suitSymbol(suit: Suit): string {
  switch (suit) {
    case 'clubs':
      return '♣';
    case 'spades':
      return '♠';
    case 'diamonds':
      return '♦';
    case 'hearts':
      return '♥';
  }
}

export function suitName(suit: Suit): string {
  switch (suit) {
    case 'clubs':
      return 'Clubs';
    case 'spades':
      return 'Spades';
    case 'diamonds':
      return 'Diamonds';
    case 'hearts':
      return 'Hearts';
  }
}

function kindFromSuit(suit: Suit): CardKind {
  switch (suit) {
    case 'clubs':
    case 'spades':
      return 'monster';
    case 'diamonds':
      return 'weapon';
    case 'hearts':
      return 'potion';
  }
}

function kindIcon(kind: CardKind): string {
  switch (kind) {
    case 'monster':
      return '☠';
    case 'weapon':
      return '⚔';
    case 'potion':
      return '⚗';
  }
}

function kindLabel(kind: CardKind): string {
  switch (kind) {
    case 'monster':
      return 'Monster';
    case 'weapon':
      return 'Weapon';
    case 'potion':
      return 'Potion';
  }
}

export interface CardViewProps {
  card: Card;
  kind?: CardKind;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children?: ReactNode;
  size?: 'normal' | 'large';
}

export default function CardView({
  card,
  kind: kindProp,
  selected,
  disabled,
  onClick,
  children,
  size = 'normal',
}: CardViewProps) {
  const kind = kindProp ?? kindFromSuit(card.suit);
  const symbol = suitSymbol(card.suit);
  const label = rankLabel(card.rank);

  return (
    <div
      className={`card-view card-view-${size} card-view-${kind} ${selected ? 'card-view-selected' : ''} ${disabled ? 'card-view-disabled' : ''}`}
      data-suit={card.suit}
      onClick={disabled ? undefined : onClick}
      onKeyDown={
        disabled || !onClick
          ? undefined
          : (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
      }
      role={onClick ? 'button' : undefined}
      tabIndex={onClick && !disabled ? 0 : undefined}
      aria-disabled={disabled}
    >
      <div className="card-inner">
        <div className="card-corner card-corner-tl">
          <span className="card-rank">{label}</span>
          <span className="card-suit">{symbol}</span>
        </div>
        <div className="card-center">
          <div className="card-kind-icon">{kindIcon(kind)}</div>
          <div className="card-value">{card.value}</div>
        </div>
        <div className="card-corner card-corner-br">
          <span className="card-rank">{label}</span>
          <span className="card-suit">{symbol}</span>
        </div>
        <div className="card-kind-label">{kindLabel(kind)}</div>
      </div>
      {children && <div className="card-children">{children}</div>}
    </div>
  );
}
