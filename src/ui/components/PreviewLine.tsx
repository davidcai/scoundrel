/**
 * The damage/cost preview line — the confirm contract (style guide §6.2).
 * Appears when a card is selected; aria-live polite so previews are spoken.
 * Shares the tooltip-era aria infrastructure (Q61).
 */
import { useMemo } from 'react';
import { useGame } from '../../store/gameStore';
import { buildPreview } from '../preview';
import './controls.css';

export function PreviewLine() {
  const game = useGame((s) => s.game);
  const selected = useGame((s) => s.selected);
  const engine = useGame((s) => s.engine);
  const preview = useMemo(
    () =>
      game === null || selected === null
        ? null
        : buildPreview(engine, game, selected.cardId, selected.barehanded),
    [engine, game, selected],
  );

  return (
    <p
      className={preview === null ? 'preview-line preview-line--empty' : 'preview-line'}
      id="preview-line"
      aria-live="polite"
    >
      {preview === null ? (
        <span className="preview-line-hint">Choose a card.</span>
      ) : (
        <>
          <span className="preview-line-headline">{preview.headline}</span>
          {preview.kind === 'monster' && !preview.legal && preview.reason !== null && (
            <span className="preview-line-reason"> — {preview.reason}</span>
          )}
          {preview.kind === 'weapon' && preview.discardsCurrent && (
            <span className="preview-line-reason"> — {preview.context}</span>
          )}
        </>
      )}
    </p>
  );
}
