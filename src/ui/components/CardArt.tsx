import type { CardId } from '../../engine';
import { artworkFor, CARD_ART_HEIGHT, CARD_ART_WIDTH } from '../artwork';
import { cn } from '../cn';

/**
 * The current PNG card illustration. Decorative here: the surrounding control
 * carries the accessible name, so the image is hidden from assistive tech.
 */
export function CardArt({ card, className }: { card: CardId; className?: string }) {
  return (
    <img
      className={cn('card-art', className)}
      src={artworkFor(card)}
      alt=""
      aria-hidden="true"
      width={CARD_ART_WIDTH}
      height={CARD_ART_HEIGHT}
      decoding="async"
      draggable={false}
    />
  );
}
