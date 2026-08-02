import type { Card } from '../game/types';
import { CARD_HEIGHT, CARD_WIDTH, RANK_LABEL, SUIT_SYMBOL } from '../game/constants';

const RED = '#b3122b';
const BLACK = '#161616';

const PIPS: Record<number, Array<[number, number]>> = {
  2: [[0, -0.62], [0, 0.62]],
  3: [[0, -0.62], [0, 0], [0, 0.62]],
  4: [[-0.5, -0.55], [0.5, -0.55], [-0.5, 0.55], [0.5, 0.55]],
  5: [[-0.5, -0.55], [0.5, -0.55], [0, 0], [-0.5, 0.55], [0.5, 0.55]],
  6: [[-0.5, -0.6], [0.5, -0.6], [-0.5, 0], [0.5, 0], [-0.5, 0.6], [0.5, 0.6]],
  7: [[-0.5, -0.6], [0.5, -0.6], [0, -0.3], [-0.5, 0], [0.5, 0], [-0.5, 0.6], [0.5, 0.6]],
  8: [[-0.5, -0.6], [0.5, -0.6], [0, -0.3], [-0.5, 0], [0.5, 0], [0, 0.3], [-0.5, 0.6], [0.5, 0.6]],
  9: [[-0.5, -0.62], [0.5, -0.62], [-0.5, -0.2], [0.5, -0.2], [0, 0], [-0.5, 0.2], [0.5, 0.2], [-0.5, 0.62], [0.5, 0.62]],
  10: [[-0.5, -0.62], [0.5, -0.62], [0, -0.42], [-0.5, -0.2], [0.5, -0.2], [-0.5, 0.2], [0.5, 0.2], [0, 0.42], [-0.5, 0.62], [0.5, 0.62]],
};

function cardColor(card: Card): string {
  return card.suit === 'hearts' || card.suit === 'diamonds' ? RED : BLACK;
}

interface Props {
  card: Card;
  faded?: boolean;
  highlight?: 'none' | 'weapon' | 'potion' | 'danger';
}

export default function CardView({ card, faded, highlight }: Props) {
  const color = cardColor(card);
  const symbol = SUIT_SYMBOL[card.suit];
  const label = RANK_LABEL[card.rank];
  const innerHalfW = 26;
  const innerHalfH = 37;
  const cx = CARD_WIDTH / 2;
  const cyInner = 61;

  const renderCenter = () => {
    if (card.rank >= 2 && card.rank <= 10) {
      const pts = PIPS[card.rank] ?? [];
      return pts.map(([fx, fy], i) => (
        <text
          key={i}
          x={cx + fx * innerHalfW}
          y={cyInner + fy * innerHalfH}
          fontSize={15}
          fill={color}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {symbol}
        </text>
      ));
    }
    if (card.rank === 14) {
      return (
        <text x={cx} y={cyInner} fontSize={42} fill={color} textAnchor="middle" dominantBaseline="central">
          {symbol}
        </text>
      );
    }
    // Face cards J/Q/K (always black in Scoundrel).
    return (
      <>
        <text x={cx} y={cyInner - 9} fontSize={30} fill={color} textAnchor="middle" dominantBaseline="central" fontWeight="bold">
          {label}
        </text>
        <text x={cx} y={cyInner + 20} fontSize={22} fill={color} textAnchor="middle" dominantBaseline="central">
          {symbol}
        </text>
      </>
    );
  };

  const stroke =
    highlight === 'weapon'
      ? '#2e7d32'
      : highlight === 'potion'
        ? '#c62828'
        : highlight === 'danger'
          ? '#d97706'
          : '#9a9a9a';

  return (
    <svg
      width={CARD_WIDTH}
      height={CARD_HEIGHT}
      viewBox={`0 0 ${CARD_WIDTH} ${CARD_HEIGHT}`}
      style={{ opacity: faded ? 0.45 : 1, display: 'block' }}
      role="img"
      aria-label={`${label} of ${card.suit}`}
    >
      <rect x={1} y={1} width={CARD_WIDTH - 2} height={CARD_HEIGHT - 2} rx={8} ry={8} fill="#fffdf6" stroke={stroke} strokeWidth={1.6} />
      <rect x={5} y={5} width={CARD_WIDTH - 10} height={CARD_HEIGHT - 10} rx={5} ry={5} fill="none" stroke={color} strokeWidth={0.4} opacity={0.5} />
      <g fill={color}>
        <text x={9} y={16} fontSize={13} fontWeight="bold" textAnchor="start" dominantBaseline="alphabetic">
          {label}
        </text>
        <text x={9} y={31} fontSize={13} textAnchor="start" dominantBaseline="alphabetic">
          {symbol}
        </text>
      </g>
      <g fill={color} transform={`rotate(180 ${cx} ${CARD_HEIGHT / 2})`}>
        <text x={9} y={16} fontSize={13} fontWeight="bold" textAnchor="start" dominantBaseline="alphabetic">
          {label}
        </text>
        <text x={9} y={31} fontSize={13} textAnchor="start" dominantBaseline="alphabetic">
          {symbol}
        </text>
      </g>
      {renderCenter()}
    </svg>
  );
}