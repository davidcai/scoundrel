import type { ReactNode } from 'react';
import type { CardId } from '../../engine';
import { cn } from '../cn';
import { CardArt } from './CardArt';

/**
 * Approved card framing (design plan D3): 1px border-2 frame, 1px bg-0 inner
 * separator, 12px radius, current PNG illustration. Children render after the
 * frame for captions or state strips. A broken weapon adds the 3px damage strip
 * in the mat margin outside the fixed frame, never over the artwork (§4/§5).
 */
export function CardFrame({
  card,
  className,
  broken = false,
  children,
}: {
  card: CardId;
  className?: string;
  broken?: boolean;
  children?: ReactNode;
}) {
  return (
    <span className={cn('card__frame', className)}>
      <span className="card__mat">
        <CardArt card={card} />
      </span>
      {broken ? <span className="card__damage" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
