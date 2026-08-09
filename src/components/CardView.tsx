import type { Card, CardRole } from '../engine';

const SUIT_SYMBOL: Record<Card['suit'], string> = {
  clubs: '\u2663',
  spades: '\u2660',
  diamonds: '\u2666',
  hearts: '\u2665',
};

const RANK_LABEL: Record<number, string> = {
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
};

function rankText(rank: number): string {
  return RANK_LABEL[rank] ?? String(rank);
}

function isRed(suit: Card['suit']): boolean {
  return suit === 'hearts' || suit === 'diamonds';
}

function roleLabel(role: CardRole, value: number): string {
  if (role === 'monster') return `DMG ${value}`;
  if (role === 'weapon') return `STR ${value}`;
  return `HEAL ${value}`;
}

interface CardViewProps {
  card: Card;
  role: CardRole;
  interactable?: boolean;
}

export function CardView({ card, role, interactable }: CardViewProps) {
  const colorClass = isRed(card.suit) ? 'card-red' : 'card-black';
  return (
    <div
      className={`card role-${role}${interactable ? ' interactable' : ''}`}
      title={`${rankText(card.rank)} of ${card.suit}`}
    >
      <div className={`card-corner top-left ${colorClass}`}>
        <span className="rank">{rankText(card.rank)}</span>
        <span className="suit">{SUIT_SYMBOL[card.suit]}</span>
      </div>
      <div className={`card-center ${colorClass}`}>{SUIT_SYMBOL[card.suit]}</div>
      <div className={`card-corner bottom-right ${colorClass}`}>
        <span className="rank">{rankText(card.rank)}</span>
        <span className="suit">{SUIT_SYMBOL[card.suit]}</span>
      </div>
      <div className={`card-value-badge ${role}`}>{roleLabel(role, card.value)}</div>
    </div>
  );
}