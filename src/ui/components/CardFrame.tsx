import type { ReactNode } from 'react';
import type { CardId } from '../../engine';
import { cn } from '../cn';
import { CardArt } from './CardArt';

/**
 * Approved card framing (design plan D3): 1px border-2 frame, 1px bg-0 inner
 * separator, 12px radius, current PNG illustration. Children render after the
 * frame for captions. The optional badge overlays the bottom of the artwork
 * inside the frame.
 */
export function CardFrame({
  card,
  className,
  badge,
  children,
}: {
  card: CardId;
  className?: string;
  badge?: string;
  children?: ReactNode;
}) {
  return (
    <span className={cn('card__frame', className)}>
      <span className="card__mat">
        <CardArt card={card} />
      </span>
      {badge !== undefined ? (
        // The label is painted from `data-badge` so the visible badge text is
        // not a DOM text node inside the card button; that keeps the accessible
        // name (which already announces the state) a visible-label match.
        <span className="card__badge" data-badge={badge} aria-hidden="true" />
      ) : null}
      {children}
    </span>
  );
}
