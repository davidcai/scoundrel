import { cardHint } from '../../i18n';
import { CursorTooltip } from './CursorTooltip';
import { useCardHover, type PlayTableHandle } from './use-card-hover';

/**
 * Cursor-anchored tooltip layer for the Phaser path: subscribes to the
 * PlayTableHandle's hover channel and renders the hovered card's hint in a
 * cursor-following DOM tooltip (pointer users; keyboard users get the hint via
 * the selection control, touch users via tap-as-hover on the game side).
 *
 * `handle` is null until the Phaser game finishes mounting; the layer renders
 * nothing then. The handle type is re-exported from `use-card-hover.ts` (the
 * one source of truth is `src/game`'s `PlayTableHandle`).
 */
export function CardHoverLayer({ handle }: { handle: PlayTableHandle | null }) {
  const hover = useCardHover(handle);
  if (hover === null) return null;
  const text = cardHint(hover.cardId);
  if (text === '') return null;
  return <CursorTooltip x={hover.x} y={hover.y} text={text} />;
}
