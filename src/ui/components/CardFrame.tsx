import type { ReactNode } from 'react';
import type { CardId } from '../../engine';
import { cn } from '../cn';
import { CardArt } from './CardArt';

/**
 * Approved card framing (design plan D3): 1px border-2 frame, 1px bg-0 inner
 * separator, 12px radius, current PNG illustration. Children render after the
 * frame for captions.
 */
export function CardFrame({
  card,
  className,
  children,
}: {
  card: CardId;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <span className={cn('card__frame', className)}>
      <span className="card__mat">
        <CardArt card={card} />
      </span>
      {children}
    </span>
  );
}
