import { labelFor } from '../game/deck';
import { cardKind, isRed } from '../game/rules';
import type { Card, CardKind, Suit } from '../game/types';

const SUIT_GLYPHS: Record<Suit, string> = {
  clubs: '♣',
  spades: '♠',
  diamonds: '♦',
  hearts: '♥',
};

const KIND_LABELS: Record<CardKind, string> = {
  monster: 'Monster',
  weapon: 'Weapon',
  potion: 'Potion',
};

interface Props {
  card: Card;
  onClick?: () => void;
  disabled?: boolean;
  mini?: boolean;
  badge?: string;
}

export default function CardView({ card, onClick, disabled, mini, badge }: Props) {
  const kind = cardKind(card);
  const red = isRed(card.suit);
  const interactive = onClick !== undefined && !disabled;
  return (
    <button
      type="button"
      className={`card ${red ? 'red' : 'black'} kind-${kind} ${mini ? 'mini' : ''} ${interactive ? 'interactive' : ''}`}
      onClick={interactive ? onClick : undefined}
      disabled={!interactive}
      aria-label={`${KIND_LABELS[kind]} ${labelFor(card.value)} of ${card.suit}`}
    >
      <span className="card-rank">{labelFor(card.value)}</span>
      <span className="card-suit-mini">{SUIT_GLYPHS[card.suit]}</span>
      <span className="card-glyph">{SUIT_GLYPHS[card.suit]}</span>
      <span className="card-kind">{KIND_LABELS[kind]}</span>
      {badge && <span className="card-badge">{badge}</span>}
    </button>
  );
}
