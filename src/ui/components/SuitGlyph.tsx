import type { Suit } from '../../engine/types'

/**
 * Hand-drawn 8x8-pixel suit glyphs. Each glyph is authored as a bitmap of
 * `X` (filled) and `.` (empty) cells, compiled into a single SVG path with
 * crispEdges rendering so pips stay sharp at any size.
 * Size inherits font-size; color inherits via currentColor + suit classes.
 */
const GLYPHS: Record<Suit, string[]> = {
  C: [
    '...XX...',
    '..XXXX..',
    'XXX..XXX',
    'XXX..XXX',
    '.XX..XX.',
    '...XX...',
    '...XX...',
    '..XXXX..',
  ],
  S: [
    '...XX...',
    '..XXXX..',
    '.XXXXXX.',
    'XXXXXXXX',
    'XXXXXXXX',
    '.XX..XX.',
    '...XX...',
    '..XXXX..',
  ],
  D: ['...XX...', '..XXXX..', '.XXXXXX.', 'XXXXXXXX', '.XXXXXX.', '..XXXX..', '...XX...'],
  H: ['.XX..XX.', 'XXXXXXXX', 'XXXXXXXX', 'XXXXXXXX', '.XXXXXX.', '..XXXX..', '...XX...'],
}

function bitmapToPath(rows: string[]): string {
  const parts: string[] = []
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) {
      if (row.charAt(x) === 'X') parts.push(`M${String(x)} ${String(y)}h1v1h-1z`)
    }
  })
  return parts.join('')
}

const PATHS: Record<Suit, string> = {
  C: bitmapToPath(GLYPHS.C),
  S: bitmapToPath(GLYPHS.S),
  D: bitmapToPath(GLYPHS.D),
  H: bitmapToPath(GLYPHS.H),
}

function viewBoxFor(suit: Suit): string {
  const rows = GLYPHS[suit]
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0)
  return `0 0 ${String(width)} ${String(rows.length)}`
}

interface SuitGlyphProps {
  suit: Suit
  /** Extra class, e.g. 'suit-glyph--flip' to invert a lower pip. */
  className?: string
}

export function SuitGlyph({ suit, className }: SuitGlyphProps) {
  return (
    <svg
      className={[
        'suit-glyph',
        `suit-glyph--${{ C: 'club', S: 'spade', D: 'diamond', H: 'heart' }[suit]}`,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      viewBox={viewBoxFor(suit)}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[suit]} fill="currentColor" />
    </svg>
  )
}
