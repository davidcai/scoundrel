/**
 * The app's single polite aria-live region (Q28b): engine Result payloads are
 * announced verbatim via announceResult. A sequence key forces re-announcement
 * when the same payload text occurs twice in a row (e.g. two undos).
 */
import { announceResult } from '../announce';
import { useGame } from '../../store/gameStore';
import './controls.css';

export function LiveRegion() {
  const result = useGame((s) => s.lastResult);
  const seq = useGame((s) => s.resultSeq);
  const text = result !== null ? announceResult(result) : null;
  return (
    <div aria-live="polite" role="status" className="sr-only" data-testid="live-region">
      {text !== null && <span key={seq}>{text}</span>}
    </div>
  );
}
