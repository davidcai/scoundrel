import type { CSSProperties } from 'react'
import type { CardId } from '../../engine/types'
import { SuitGlyph } from './SuitGlyph'
import { SUIT_META, describeCard, parseCard } from './card-utils'
import type { ParsedCard } from './card-utils'

/* Mystery glyph on the deck back: a simple stepped dagger. */
const PATH_FOR_BACK =
  'M3 0h2v4H3zM2 4h4v1H2zM3 5h1v1H3zM4 5h1v1H4zM3 6h2v1H3zM3 7h2v1H3zM4 0h1v1H4z'

interface CardProps {
  cardId: CardId
  /** Render as the dungeon deck back instead of a face. */
  faceDown?: boolean
  /** Visually lifted + focus-colored ring (selection lives in the store). */
  selected?: boolean
  disabled?: boolean
  /** When provided, the card becomes a real <button>. */
  onClick?: (cardId: CardId) => void
  className?: string
}

function CardBack() {
  return (
    <span className="card-face">
      <svg
        className="card-back-glyph"
        viewBox="0 0 8 8"
        shapeRendering="crispEdges"
        aria-hidden="true"
      >
        <path d={PATH_FOR_BACK} fill="currentColor" />
      </svg>
    </span>
  )
}

function CardFace({ parsed }: { parsed: ParsedCard }) {
  const { rank, suit, value } = parsed
  const isCourtOrAce = rank === 'J' || rank === 'Q' || rank === 'K' || rank === 'A'
  const pipRows = Math.ceil(value / 2)
  /** Glyph width as a fraction of --card-w: denser boards get smaller pips
   *  so five pip rows always fit inside the chip-cleared field. */
  const pipSize = pipRows >= 5 ? 0.115 : pipRows === 4 ? 0.15 : pipRows === 3 ? 0.185 : 0.24
  return (
    <>
      <span className="card-corner card-corner--tl">
        <span className="card-rank">{rank}</span>
        <SuitGlyph suit={suit} />
      </span>
      <span className="card-face">
        {isCourtOrAce ? (
          <span className="card-court">
            <SuitGlyph suit={suit} />
            <span className="card-court-letter">{rank}</span>
          </span>
        ) : (
          <span
            className="card-pips"
            style={{ '--pip-rows': pipRows, '--pip-size': pipSize } as CSSProperties}
          >
            {Array.from({ length: value }, (_, i) => (
              <SuitGlyph
                key={i}
                suit={suit}
                className={i >= pipRows ? 'suit-glyph--flip' : undefined}
              />
            ))}
          </span>
        )}
      </span>
      <span className="card-corner card-corner--br">
        <span className="card-rank">{rank}</span>
        <SuitGlyph suit={suit} />
      </span>
    </>
  )
}

export function Card({
  cardId,
  faceDown = false,
  selected = false,
  disabled = false,
  onClick,
  className,
}: CardProps) {
  const parsed = faceDown ? null : parseCard(cardId)
  const classes = [
    'card',
    parsed ? `card--${SUIT_META[parsed.suit].cssClass}` : 'card--down',
    selected && 'card--selected',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const label = faceDown
    ? 'Dungeon deck, face down'
    : parsed
      ? describeCard(parsed)
      : `Unknown card ${cardId}`

  const content = parsed ? <CardFace parsed={parsed} /> : <CardBack />

  if (onClick) {
    return (
      <button
        type="button"
        className={classes}
        aria-label={label}
        aria-pressed={selected}
        disabled={disabled}
        onClick={() => {
          onClick(cardId)
        }}
      >
        {content}
      </button>
    )
  }

  return (
    <div className={classes} role="img" aria-label={label}>
      {content}
    </div>
  )
}
